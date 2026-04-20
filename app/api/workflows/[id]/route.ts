import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, requireAuth } from "@/lib/auth";
import type { Prisma } from "@prisma/client";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ────────────────────────────────────────────────────────────
// GET /api/workflows/[id]
// ────────────────────────────────────────────────────────────
export async function GET(_req: Request, ctx: RouteContext) {
  try {
    const userId = await requireAuth();
    const { id } = await ctx.params;

    const workflow = await prisma.workflow.findUnique({ where: { id } });
    if (!workflow) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (workflow.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    return NextResponse.json({ workflow });
  } catch (error) {
    console.error("[GET /api/workflows/[id]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ────────────────────────────────────────────────────────────
// PATCH /api/workflows/[id] — save canvas state
// ────────────────────────────────────────────────────────────
const patchWorkflowSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  nodes: z.array(z.record(z.string(), z.unknown())).optional(),
  edges: z.array(z.record(z.string(), z.unknown())).optional(),
  viewport: z.object({ x: z.number(), y: z.number(), zoom: z.number() }).optional(),
  thumbnail: z.string().url().optional(),
  isPublic: z.boolean().optional(),
});

// Cast unknown JSON to Prisma's InputJsonValue safely
function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export async function PATCH(req: Request, ctx: RouteContext) {
  try {
    const userId = await requireAuth();
    const { id } = await ctx.params;

    const workflow = await prisma.workflow.findUnique({ where: { id } });
    if (!workflow) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (workflow.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body: unknown = await req.json();
    const data = patchWorkflowSchema.parse(body);

    const updated = await prisma.workflow.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.nodes !== undefined && { nodes: toJson(data.nodes) }),
        ...(data.edges !== undefined && { edges: toJson(data.edges) }),
        ...(data.viewport !== undefined && { viewport: toJson(data.viewport) }),
        ...(data.thumbnail !== undefined && { thumbnail: data.thumbnail }),
        ...(data.isPublic !== undefined && { isPublic: data.isPublic }),
      },
    });

    return NextResponse.json({ workflow: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", issues: error.issues }, { status: 400 });
    }
    console.error("[PATCH /api/workflows/[id]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ────────────────────────────────────────────────────────────
// DELETE /api/workflows/[id]
// ────────────────────────────────────────────────────────────
export async function DELETE(_req: Request, ctx: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;

    const workflow = await prisma.workflow.findUnique({ where: { id } });
    if (!workflow) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (workflow.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await prisma.workflow.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/workflows/[id]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
