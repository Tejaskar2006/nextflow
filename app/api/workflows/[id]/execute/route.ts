import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { tasks } from "@trigger.dev/sdk/v3";
import { validateWorkflowForExecution } from "@/lib/dag/validator";
import type { WorkflowNode, WorkflowEdge } from "@/types/nodes";
import type { WorkflowExecutionTaskPayload } from "@/types/runs";
import type { executeWorkflowTask } from "@/trigger/executeWorkflow";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const executeSchema = z.object({
  scope: z.enum(["FULL", "SINGLE", "SELECTED"]).default("FULL"),
  selectedNodeIds: z.array(z.string()).optional().default([]),
  nodeSnapshot: z.object({
    nodes: z.array(z.record(z.string(), z.unknown())),
    edges: z.array(z.record(z.string(), z.unknown())),
  }).optional(),
});

// POST /api/workflows/[id]/execute
export async function POST(req: Request, ctx: RouteContext) {
  let workflowRunId: string | undefined;

  try {
    const user = await requireUser();
    const { id } = await ctx.params;

    // Load and authorize workflow
    const workflow = await prisma.workflow.findUnique({ where: { id } });
    if (!workflow) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (workflow.userId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body: unknown = await req.json();
    const { scope, selectedNodeIds, nodeSnapshot } = executeSchema.parse(body);

    const nodes = workflow.nodes as unknown as WorkflowNode[];
    const edges = workflow.edges as unknown as WorkflowEdge[];

    // Pre-execution DAG validation
    const validation = validateWorkflowForExecution(
      nodes,
      edges,
      scope === "SELECTED" ? selectedNodeIds : undefined
    );

    if (!validation.valid) {
      return NextResponse.json(
        { error: "Workflow validation failed", details: validation.errors },
        { status: 422 }
      );
    }

    // Create WorkflowRun record first — always persisted before Trigger.dev call
    const workflowRun = await prisma.workflowRun.create({
      data: {
        id: `run_${Math.random().toString(36).slice(2, 11)}`,
        workflowId: id,
        userId: user.id,
        status: "PENDING",
        scope,
        scopedNodeIds: selectedNodeIds,
      },
    });

    workflowRunId = workflowRun.id;

    // Dispatch to Trigger.dev
    const taskPayload: WorkflowExecutionTaskPayload = {
      workflowRunId: workflowRun.id,
      workflowId: id,
      userId: user.id,
      scope,
      selectedNodeIds,
      nodeSnapshot,
    };

    let triggerRunId: string | undefined;

    try {
      const handle = await tasks.trigger<typeof executeWorkflowTask>(
        "execute-workflow",
        taskPayload
      );
      triggerRunId = handle.id;

      // Save the Trigger.dev run handle
      await prisma.workflowRun.update({
        where: { id: workflowRun.id },
        data: { triggerRunId: handle.id },
      });
    } catch (triggerError) {
      // Trigger.dev unavailable (e.g. invalid key, network error).
      // Mark the run as FAILED so the UI can display a clear error instead of hanging.
      const errMsg =
        triggerError instanceof Error ? triggerError.message : String(triggerError);

      await prisma.workflowRun.update({
        where: { id: workflowRun.id },
        data: { status: "FAILED", completedAt: new Date(), durationMs: 0, error: errMsg },
      });

      // Still return the run ID — lets the UI show the FAILED state immediately
      return NextResponse.json(
        {
          workflowRunId: workflowRun.id,
          triggerRunId: null,
          status: "FAILED",
          error: `Trigger.dev error: ${errMsg}. Check TRIGGER_SECRET_KEY in your .env`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      workflowRunId: workflowRun.id,
      triggerRunId,
      status: "PENDING",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", issues: error.issues }, { status: 400 });
    }
    console.error("[POST /api/workflows/[id]/execute]", error);
    return NextResponse.json(
      { error: "Internal server error", workflowRunId },
      { status: 500 }
    );
  }
}
