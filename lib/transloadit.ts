import crypto from "crypto";

const TRANSLOADIT_KEY = process.env["TRANSLOADIT_KEY"];
const TRANSLOADIT_SECRET = process.env["TRANSLOADIT_SECRET"];
const TRANSLOADIT_IMAGE_TEMPLATE_ID = process.env["TRANSLOADIT_IMAGE_TEMPLATE_ID"];
const TRANSLOADIT_VIDEO_TEMPLATE_ID = process.env["TRANSLOADIT_VIDEO_TEMPLATE_ID"];

function assertEnv(val: string | undefined, name: string): string {
  if (!val) throw new Error(`${name} is not configured. Check .env.local`);
  return val;
}

export type TransloaditAssetType = "image" | "video";

export interface AssemblyOptions {
  params: string;
  signature: string;
}

/**
 * Generates Transloadit assembly options with server-side HMAC-SHA384 signature.
 * Uses Node.js crypto directly to avoid API incompatibilities with @transloadit/utils v4.
 */
export function generateAssemblyOptions(
  assetType: TransloaditAssetType
): AssemblyOptions {
  const key = assertEnv(TRANSLOADIT_KEY, "TRANSLOADIT_KEY");
  const secret = assertEnv(TRANSLOADIT_SECRET, "TRANSLOADIT_SECRET");

  const templateId =
    assetType === "image"
      ? assertEnv(TRANSLOADIT_IMAGE_TEMPLATE_ID, "TRANSLOADIT_IMAGE_TEMPLATE_ID")
      : assertEnv(TRANSLOADIT_VIDEO_TEMPLATE_ID, "TRANSLOADIT_VIDEO_TEMPLATE_ID");

  // Expires in 1 hour (UTC ISO string — Transloadit format)
  const expires = new Date(Date.now() + 60 * 60 * 1000)
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d+Z$/, "+00:00");

  const paramsObj = {
    auth: { key, expires },
    template_id: templateId,
  };

  const paramsStr = JSON.stringify(paramsObj);

  // HMAC-SHA384 — Transloadit's required signing algorithm
  const signature = crypto
    .createHmac("sha384", secret)
    .update(Buffer.from(paramsStr, "utf-8"))
    .digest("hex");

  return {
    params: paramsStr,
    signature: `sha384:${signature}`,
  };
}
