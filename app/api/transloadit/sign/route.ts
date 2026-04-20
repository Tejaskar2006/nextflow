import { NextResponse } from "next/server";
import { z } from "zod";
import { generateAssemblyOptions } from "@/lib/transloadit";
import { requireAuth } from "@/lib/auth";

const signSchema = z.object({
  assetType: z.enum(["image", "video"]),
});

// POST /api/transloadit/sign — returns HMAC-signed assembly params
export async function POST(request: Request) {
  try {
    await requireAuth();

    const body: unknown = await request.json();
    const { assetType } = signSchema.parse(body);

    const options = generateAssemblyOptions(assetType);

    return NextResponse.json(options);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", issues: error.issues }, { status: 400 });
    }
    console.error("[POST /api/transloadit/sign]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
