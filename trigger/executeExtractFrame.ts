// ============================================================
// TRIGGER.DEV TASK: execute-extract-frame-node
// Downloads video, extracts a frame at a given timestamp via FFmpeg.
// ============================================================

import { task, logger } from "@trigger.dev/sdk/v3";
import { prisma } from "@/lib/prisma";
import type { ExtractFrameTaskPayload, ExtractFrameTaskOutput } from "@/types/runs";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import ffmpeg from "fluent-ffmpeg";
import { uploadToCloudinary } from "@/lib/cloudinary";

// ────────────────────────────────────────────────────────────
// Ensure FFmpeg binary path is robust for Windows/Trigger.dev build
// ────────────────────────────────────────────────────────────
try {
  const ffmpegRawPath = require.resolve("ffmpeg-static");
  const ffmpegDir = path.dirname(ffmpegRawPath);
  const ffmpegPath = path.join(ffmpegDir, "ffmpeg.exe");
  ffmpeg.setFfmpegPath(ffmpegPath);
  logger.log(`[FFMPEG] Resolved binary via require.resolve: ${ffmpegPath}`);
} catch (e) {
  // Hardcoded fallback for your specific machine as a last resort
  const fallbackPath = "D:\\Galaxy.ai\\nextflow\\node_modules\\ffmpeg-static\\ffmpeg.exe";
  ffmpeg.setFfmpegPath(fallbackPath);
  logger.log(`[FFMPEG] require.resolve failed, using fallback: ${fallbackPath}`);
}


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
// Note: uploadProcessedFile (base64) was replaced by lib/cloudinary.ts
// ────────────────────────────────────────────────────────────

function extractFrame(
  inputPath: string,
  outputPath: string,
  timeOffsetSeconds: number
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    let width = 0;
    let height = 0;

    ffmpeg(inputPath)
      .seekInput(timeOffsetSeconds)
      .outputOptions(["-frames:v 1", "-q:v 2"])
      .output(outputPath)
      .on("codecData", (data: { video_details: string[] }) => {
        const videoDetails = data.video_details ?? [];
        for (const detail of videoDetails) {
          const match = /(\d+)x(\d+)/.exec(detail);
          if (match?.[1] && match?.[2]) {
            width = parseInt(match[1], 10);
            height = parseInt(match[2], 10);
          }
        }
      })
      .on("end", () => resolve({ width, height }))
      .on("error", (err: Error) => reject(err))
      .run();
  });
}

function mimeForFormat(format: "jpg" | "png" | "webp"): string {
  return { jpg: "image/jpeg", png: "image/png", webp: "image/webp" }[format];
}

export const executeExtractFrameTask = task({
  id: "execute-extract-frame-node",
  maxDuration: 120,
  run: async (
    payload: ExtractFrameTaskPayload
  ): Promise<ExtractFrameTaskOutput> => {
    const { nodeRunId, videoUrl, timeOffsetSeconds, outputFormat } = payload;

    logger.log("Starting extract frame node", {
      nodeRunId,
      timeOffsetSeconds,
      outputFormat,
    });

    await prisma.nodeRun.update({
      where: { id: nodeRunId },
      data: { status: "RUNNING", startedAt: new Date() },
    });

    const startMs = Date.now();
    let videoPath: string | null = null;
    let framePath: string | null = null;

    try {
      videoPath = await downloadToTemp(videoUrl, ".mp4");
      framePath = path.join(
        os.tmpdir(),
        `nextflow_frame_${Date.now()}.${outputFormat}`
      );

      const { width, height } = await extractFrame(
        videoPath,
        framePath,
        timeOffsetSeconds
      );

      const result = await uploadToCloudinary(framePath, "nextflow-frames");
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
            timestampSeconds: timeOffsetSeconds,
          },
        },
      });

      logger.log("Extract frame node completed", { nodeRunId, durationMs });

      return {
        outputUrl,
        widthPx: width,
        heightPx: height,
        timestampSeconds: timeOffsetSeconds,
      };
    } catch (error) {
      const durationMs = Date.now() - startMs;
      const errMsg = error instanceof Error ? error.message : String(error);
      const errStack = error instanceof Error ? (error.stack ?? null) : null;

      logger.error("Extract frame node failed", { nodeRunId, error: errMsg });

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
      if (videoPath) await fs.unlink(videoPath).catch(() => null);
      if (framePath) await fs.unlink(framePath).catch(() => null);
    }
  },
});
