import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

interface RouteContext {
  params: Promise<{ runId: string }>;
}

// GET /api/runs/[runId] — single run with all node-level data
export async function GET(_req: Request, ctx: RouteContext) {
  try {
    const userId = await requireAuth();
    const { runId } = await ctx.params;

    const run = await prisma.workflowRun.findUnique({
      where: { id: runId },
      include: {
        nodeRuns: { orderBy: { startedAt: "asc" } },
      },
    });

    if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (run.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    return NextResponse.json({ run });
  } catch (error) {
    console.error("[GET /api/runs/[runId]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  try {
    const userId = await requireAuth();
    const { runId } = await ctx.params;

    const run = await prisma.workflowRun.findUnique({
      where: { id: runId },
    });

    if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (run.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await prisma.workflowRun.delete({ where: { id: runId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/runs/[runId]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
