import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Check for missing config
const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

console.log("[CLOUDINARY] Config Check:", {
  cloudName: cloudName ? `${cloudName.slice(0, 3)}...` : "MISSING",
  apiKey: apiKey ? `${apiKey.slice(0, 3)}...` : "MISSING",
  apiSecret: apiSecret ? `${apiSecret.slice(0, 3)}...` : "MISSING",
});

if (!cloudName || !apiKey || !apiSecret) {
  console.error("❌ CLOUDINARY CONFIG ERROR: Missing environment variables! Re-hosting will fail.");
}

export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  width: number;
  height: number;
  format: string;
}

/**
 * Uploads a local file to Cloudinary
 */
export async function uploadToCloudinary(
  filePath: string,
  folder: string = "nextflow-outputs"
): Promise<CloudinaryUploadResult> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      filePath,
      {
        folder,
        resource_type: "auto", // will handle images or frames correctly
      },
      (error, result) => {
        if (error) {
          console.error("Cloudinary upload error:", error);
          return reject(error);
        }
        if (!result) return reject(new Error("No result from Cloudinary"));
        
        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
          width: result.width,
          height: result.height,
          format: result.format,
        });
      }
    );
  });
}

/**
 * Uploads a remote URL directly to Cloudinary (no local file needed).
 * Used to permanently host Transloadit-uploaded files so they are
 * publicly accessible for Gemini vision API.
 */
export async function uploadUrlToCloudinary(
  remoteUrl: string,
  folder: string = "nextflow-uploads"
): Promise<CloudinaryUploadResult> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      remoteUrl,
      {
        folder,
        resource_type: "auto",
      },
      (error, result) => {
        if (error) {
          console.error("Cloudinary URL upload error:", error);
          return reject(error);
        }
        if (!result) return reject(new Error("No result from Cloudinary"));
        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
          width: result.width,
          height: result.height,
          format: result.format,
        });
      }
    );
  });
}

export default cloudinary;
