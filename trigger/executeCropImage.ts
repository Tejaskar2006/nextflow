// ============================================================
// TRIGGER.DEV TASK: execute-crop-image-node
// Downloads image, crops via FFmpeg, uploads result.
// Updates NodeRun in PostgreSQL on completion.
// ============================================================

import { task, logger } from "@trigger.dev/sdk/v3";
import { prisma } from "@/lib/prisma";
import type { CropImageTaskPayload, CropImageTaskOutput } from "@/types/runs";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import ffmpeg from "fluent-ffmpeg";
import { uploadToCloudinary } from "@/lib/cloudinary";

// ────────────────────────────────────────────────────────────
// Ensure FFmpeg binary path is robust for Windows/Linux/Trigger.dev build
// ────────────────────────────────────────────────────────────
try {
  const ffmpegStatic = require("ffmpeg-static");
  const ffmpegPath = typeof ffmpegStatic === "string" ? ffmpegStatic : require.resolve("ffmpeg-static");
  ffmpeg.setFfmpegPath(ffmpegPath);
  logger.log(`[FFMPEG] Resolved binary: ${ffmpegPath}`);
} catch (e) {
  logger.error("[FFMPEG] Failed to resolve ffmpeg-static. Ensure it is in dependencies.", { error: String(e) });
}


// ────────────────────────────────────────────────────────────
// Helper: Download a URL to a temp file
// ────────────────────────────────────────────────────────────
async function downloadToTemp(url: string, suffix: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.statusText}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const tmpPath = path.join(os.tmpdir(), `nextflow_${Date.now()}${suffix}`);
  await fs.writeFile(tmpPath, buffer);
  return tmpPath;
}

// ────────────────────────────────────────────────────────────
// Helper: Upload a local file to our temp hosting
// In production this should upload to S3/R2/Transloadit.
// For now we encode as base64 data URL (works for < 5MB images).
// ────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────
// Note: uploadProcessedFile (base64) was replaced by lib/cloudinary.ts
// ────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────
// Crop via FFmpeg
// ────────────────────────────────────────────────────────────
function cropImage(
  inputPath: string,
  outputPath: string,
  x: number,
  y: number,
  width: number,
  height: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoFilters(`crop=${width}:${height}:${x}:${y}`)
      .outputOptions("-frames:v 1")
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (err: Error) => reject(err))
      .run();
  });
}

// ────────────────────────────────────────────────────────────
// TASK
// ────────────────────────────────────────────────────────────
export const executeCropImageTask = task({
  id: "execute-crop-image-node",
  maxDuration: 120,
  run: async (payload: CropImageTaskPayload): Promise<CropImageTaskOutput> => {
    const { nodeRunId, imageUrl, x, y, width, height } = payload;

    logger.log("Starting crop image node", {
      nodeRunId,
      x,
      y,
      width,
      height,
    });

    await prisma.nodeRun.update({
      where: { id: nodeRunId },
      data: { status: "RUNNING", startedAt: new Date() },
    });

    const startMs = Date.now();
    let inputPath: string | null = null;
    let outputPath: string | null = null;

    try {
      inputPath = await downloadToTemp(imageUrl, ".jpg");
      outputPath = path.join(os.tmpdir(), `nextflow_crop_${Date.now()}.jpg`);

      await cropImage(inputPath, outputPath, x, y, width, height);

      const result = await uploadToCloudinary(outputPath, "nextflow-crops");
      const outputUrl = result.secure_url;
      const durationMs = Date.now() - startMs;

      await prisma.nodeRun.update({
        where: { id: nodeRunId },
        data: {
          status: "SUCCESS",
          completedAt: new Date(),
          durationMs,
          outputs: {
            outputUrl,
            widthPx: width,
            heightPx: height,
          },
        },
      });

      logger.log("Crop image node completed", { nodeRunId, durationMs });

      return { outputUrl, widthPx: width, heightPx: height };
    } catch (error) {
      const durationMs = Date.now() - startMs;
      const errMsg = error instanceof Error ? error.message : String(error);
      const errStack = error instanceof Error ? (error.stack ?? null) : null;

      logger.error("Crop image node failed", { nodeRunId, error: errMsg });

      await prisma.nodeRun.update({
        where: { id: nodeRunId },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          durationMs,
          error: errMsg,
          errorStack: errStack,
        },
      });

      throw error;
    } finally {
      // Clean up temp files
      if (inputPath) await fs.unlink(inputPath).catch(() => null);
      if (outputPath) await fs.unlink(outputPath).catch(() => null);
    }
  },
});
