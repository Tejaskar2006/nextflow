import {
  uploadToCloudinary
} from "./chunk-GYQSCBOT.mjs";
import {
  prisma
} from "./chunk-3TBU5GII.mjs";
import {
  logger,
  task
} from "./chunk-WQZVUSXU.mjs";
import "./chunk-TWXJQJ5T.mjs";
import {
  __name,
  __require,
  init_esm
} from "./chunk-CK3VH6Y3.mjs";

// trigger/executeCropImage.ts
init_esm();
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import ffmpeg from "fluent-ffmpeg";
try {
  const ffmpegRawPath = __require.resolve("ffmpeg-static");
  const ffmpegDir = path.dirname(ffmpegRawPath);
  const ffmpegPath = path.join(ffmpegDir, "ffmpeg.exe");
  ffmpeg.setFfmpegPath(ffmpegPath);
  logger.log(`[FFMPEG] Resolved binary via require.resolve: ${ffmpegPath}`);
} catch (e) {
  const fallbackPath = "D:\\Galaxy.ai\\nextflow\\node_modules\\ffmpeg-static\\ffmpeg.exe";
  ffmpeg.setFfmpegPath(fallbackPath);
  logger.log(`[FFMPEG] require.resolve failed, using fallback: ${fallbackPath}`);
}
async function downloadToTemp(url, suffix) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.statusText}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const tmpPath = path.join(os.tmpdir(), `nextflow_${Date.now()}${suffix}`);
  await fs.writeFile(tmpPath, buffer);
  return tmpPath;
}
__name(downloadToTemp, "downloadToTemp");
function cropImage(inputPath, outputPath, x, y, width, height) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath).videoFilters(`crop=${width}:${height}:${x}:${y}`).outputOptions("-frames:v 1").output(outputPath).on("end", () => resolve()).on("error", (err) => reject(err)).run();
  });
}
__name(cropImage, "cropImage");
var executeCropImageTask = task({
  id: "execute-crop-image-node",
  maxDuration: 120,
  run: /* @__PURE__ */ __name(async (payload) => {
    const { nodeRunId, imageUrl, x, y, width, height } = payload;
    logger.log("Starting crop image node", {
      nodeRunId,
      x,
      y,
      width,
      height
    });
    await prisma.nodeRun.update({
      where: { id: nodeRunId },
      data: { status: "RUNNING", startedAt: /* @__PURE__ */ new Date() }
    });
    const startMs = Date.now();
    let inputPath = null;
    let outputPath = null;
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
          completedAt: /* @__PURE__ */ new Date(),
          durationMs,
          outputs: {
            outputUrl,
            widthPx: width,
            heightPx: height
          }
        }
      });
      logger.log("Crop image node completed", { nodeRunId, durationMs });
      return { outputUrl, widthPx: width, heightPx: height };
    } catch (error) {
      const durationMs = Date.now() - startMs;
      const errMsg = error instanceof Error ? error.message : String(error);
      const errStack = error instanceof Error ? error.stack ?? null : null;
      logger.error("Crop image node failed", { nodeRunId, error: errMsg });
      await prisma.nodeRun.update({
        where: { id: nodeRunId },
        data: {
          status: "FAILED",
          completedAt: /* @__PURE__ */ new Date(),
          durationMs,
          error: errMsg,
          errorStack: errStack
        }
      });
      throw error;
    } finally {
      if (inputPath) await fs.unlink(inputPath).catch(() => null);
      if (outputPath) await fs.unlink(outputPath).catch(() => null);
    }
  }, "run")
});
export {
  executeCropImageTask
};
//# sourceMappingURL=executeCropImage.mjs.map
