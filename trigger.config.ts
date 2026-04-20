import { defineConfig } from "@trigger.dev/sdk/v3";
import * as dotenv from "dotenv";

dotenv.config();

export default defineConfig({
  project: process.env["TRIGGER_PROJECT_ID"] ?? "nextflow",
  runtime: "node",
  logLevel: "log",
  maxDuration: 300, // 5 minutes per task
  dirs: ["./trigger"],
  build: {
    external: ["ffmpeg-static", "fluent-ffmpeg"],
  },
});
