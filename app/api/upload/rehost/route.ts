import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { uploadUrlToCloudinary } from "@/lib/cloudinary";

const schema = z.object({
  url: z.string().url(),
  folder: z.string().optional(),
});

/**
 * POST /api/upload/rehost
 * Accepts a temporary Transloadit URL and re-uploads it to Cloudinary,
 * returning a permanent public URL that Gemini can access.
 */
export async function POST(request: Request) {
  try {
    await requireAuth();
    const body: unknown = await request.json();
    const { url, folder } = schema.parse(body);

    const result = await uploadUrlToCloudinary(url, folder ?? "nextflow-uploads");

    return NextResponse.json({ url: result.secure_url });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", issues: error.issues }, { status: 400 });
    }
    const errorMessage = error instanceof Error ? error.message : "Failed to rehost file";
    console.error("[POST /api/upload/rehost] Error:", errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
