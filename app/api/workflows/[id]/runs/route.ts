import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/workflows/[id]/runs — list all runs for a workflow
export async function GET(_req: Request, ctx: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;

    // Ownership check
    const workflow = await prisma.workflow.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!workflow) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (workflow.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const runs = await prisma.workflowRun.findMany({
      where: { workflowId: id },
      orderBy: { startedAt: "desc" },
      take: 50,
      include: {
        nodeRuns: {
          orderBy: { startedAt: "asc" },
        },
      },
    });

    return NextResponse.json({ runs, total: runs.length });
  } catch (error) {
    console.error("[GET /api/workflows/[id]/runs]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
