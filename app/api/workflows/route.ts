import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, requireAuth } from "@/lib/auth";

// ────────────────────────────────────────────────────────────
// GET /api/workflows — list all workflows for the current user
// ────────────────────────────────────────────────────────────
export async function GET() {
  try {
    const userId = await requireAuth();

    const workflows = await prisma.workflow.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        thumbnail: true,
        isPublic: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { workflowRuns: true } },
      },
    });

    return NextResponse.json({ workflows });
  } catch (error) {
    console.error("[GET /api/workflows]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ────────────────────────────────────────────────────────────
// POST /api/workflows — create a new workflow
// ────────────────────────────────────────────────────────────
const createWorkflowSchema = z.object({
  name: z.string().min(1).max(100).default("Untitled Workflow"),
  description: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body: unknown = await request.json();
    const data = createWorkflowSchema.parse(body);

    const workflow = await prisma.workflow.create({
      data: {
        userId: user.id,
        name: data.name,
        description: data.description,
        nodes: [],
        edges: [],
      },
    });

    return NextResponse.json({ workflow }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: error.issues },
        { status: 400 }
      );
    }
    console.error("[POST /api/workflows]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
