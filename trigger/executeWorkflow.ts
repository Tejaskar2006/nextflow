// ============================================================
// TRIGGER.DEV TASK: execute-workflow
// ============================================================

import { task, logger, tasks } from "@trigger.dev/sdk/v3";
import { prisma } from "@/lib/prisma";
import { computeExecutionPlan, ExecutionResultStore } from "@/lib/dag/engine";
import type {
  WorkflowExecutionTaskPayload,
  LLMTaskPayload,
  CropImageTaskPayload,
  ExtractFrameTaskPayload,
} from "@/types/runs";
import type { WorkflowNode, WorkflowEdge } from "@/types/nodes";
import type { Prisma } from "@prisma/client";

import type { executeLLMNodeTask } from "./executeLLMNode";
import type { executeCropImageTask } from "./executeCropImage";
import type { executeExtractFrameTask } from "./executeExtractFrame";

// Safe cast to Prisma InputJsonValue
function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export const executeWorkflowTask = task({
  id: "execute-workflow",
  maxDuration: 300,
  run: async (payload: WorkflowExecutionTaskPayload): Promise<void> => {
    const { workflowRunId, workflowId, scope, selectedNodeIds } = payload;

    logger.log("Starting workflow execution", { workflowRunId, workflowId, scope });

    await prisma.workflowRun.update({
      where: { id: workflowRunId },
      data: { status: "RUNNING" },
    });

    const startMs = Date.now();

    try {
      const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });
      if (!workflow) throw new Error(`Workflow ${workflowId} not found`);

      const nodes = workflow.nodes as unknown as WorkflowNode[];
      const edges = workflow.edges as unknown as WorkflowEdge[];

      const plan = computeExecutionPlan(
        nodes, edges,
        scope === "SELECTED" ? selectedNodeIds : undefined
      );

      logger.log("Execution plan computed", {
        levels: plan.levels.length,
        totalNodes: plan.executionNodes.length,
      });

      const resultStore = new ExecutionResultStore();
      const nodeResults: Record<string, "success" | "failed" | "skipped"> = {};

      for (const level of plan.levels) {
        logger.log(`Executing level ${level.level}`, { nodeIds: level.nodeIds });

        // ⚠️ IMPORTANT: Trigger.dev v3 does NOT support triggerAndWait inside
        // Promise.all/allSettled. All nodes MUST be run sequentially.
        for (const nodeId of level.nodeIds) {
          const node = nodes.find((n) => n.id === nodeId);
          if (!node) {
            logger.warn(`Node ${nodeId} not found, skipping`);
            continue;
          }

          const resolvedInputs = resultStore.getResolvedInputs(nodeId, edges);

          const nodeRun = await prisma.nodeRun.create({
            data: {
              id: `nr_${Math.random().toString(36).slice(2)}`,
              workflowRunId,
              nodeId,
              nodeType: nodeTypeToEnum(node.type),
              nodeLabel: (node.data as { label?: string }).label ?? null,
              status: "PENDING",
              inputs: toJson(resolvedInputs),
              outputs: toJson({}),
            },
          });

          try {
            const output = await executeNode(node, nodeRun.id, workflowRunId, resolvedInputs);
            resultStore.setOutput(nodeId, output);
            nodeResults[nodeId] = "success";
          } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            logger.error(`Node ${nodeId} failed`, { error: errMsg });

            await prisma.nodeRun.update({
              where: { id: nodeRun.id },
              data: {
                status: "FAILED",
                error: errMsg,
                completedAt: new Date(),
              },
            });

            resultStore.markFailed(nodeId);
            nodeResults[nodeId] = "failed";
          }
        }
      }

      const statuses = Object.values(nodeResults);
      const hasFailures = statuses.some((s) => s === "failed" || s === "skipped");
      const hasSuccesses = statuses.some((s) => s === "success");

      const finalStatus: "SUCCESS" | "FAILED" | "PARTIAL" = !hasFailures
        ? "SUCCESS"
        : !hasSuccesses
        ? "FAILED"
        : "PARTIAL";

      await prisma.workflowRun.update({
        where: { id: workflowRunId },
        data: { status: finalStatus, completedAt: new Date(), durationMs: Date.now() - startMs },
      });

      logger.log("Workflow execution completed", { workflowRunId, finalStatus });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error("Workflow execution failed", { workflowRunId, error: errMsg });
      await prisma.workflowRun.update({
        where: { id: workflowRunId },
        data: { status: "FAILED", completedAt: new Date(), durationMs: Date.now() - startMs, error: errMsg },
      });
      throw error;
    }
  },
});

// ────────────────────────────────────────────────────────────
// NODE DISPATCHER
// ────────────────────────────────────────────────────────────
async function executeNode(
  node: WorkflowNode,
  nodeRunId: string,
  workflowRunId: string,
  resolvedInputs: Record<string, unknown>
): Promise<unknown> {
  function toJson(v: unknown): import("@prisma/client").Prisma.InputJsonValue {
    return v as import("@prisma/client").Prisma.InputJsonValue;
  }

  switch (node.type) {
    case "text": {
      const textData = node.data as { text?: string };
      const connectedTextObj = resolvedInputs["text__0"] as { text?: string } | string | undefined;
      const text = typeof connectedTextObj === "string" 
        ? connectedTextObj 
        : (connectedTextObj?.text ?? textData.text ?? "");

      await prisma.nodeRun.update({
        where: { id: nodeRunId },
        data: { status: "SUCCESS", startedAt: new Date(), completedAt: new Date(), durationMs: 0, inputs: toJson(resolvedInputs), outputs: toJson({ text }) },
      });
      return { text };
    }

    case "upload_image":
    case "upload_video": {
      const uploadData = node.data as { uploadedUrl?: string };
      const url = uploadData.uploadedUrl ?? "";
      await prisma.nodeRun.update({
        where: { id: nodeRunId },
        data: { status: "SUCCESS", startedAt: new Date(), completedAt: new Date(), durationMs: 0, inputs: toJson(resolvedInputs), outputs: toJson({ url }) },
      });
      return { url };
    }

    case "llm": {
      const llmData = node.data as { model?: string; systemPrompt?: string; userMessage?: string };
      const connectedTextObj = resolvedInputs["text__0"] as { text?: string } | string | undefined;
      const connectedText = typeof connectedTextObj === 'string' ? connectedTextObj : connectedTextObj?.text;

      logger.log(`[LLM] Resolved inputs for ${nodeRunId}`, {
        keys: Object.keys(resolvedInputs),
        resolvedInputs: JSON.stringify(resolvedInputs).slice(0, 500),
      });

      const imageUrls = Object.entries(resolvedInputs)
        .filter(([key]) => key.startsWith("image__"))
        .map(([, val]) => {
          if (typeof val === "string") return val;
          // Handle all known output shapes from upstream nodes:
          // upload_image/video  -> { url: "..." }
          // crop_image          -> { outputUrl: "...", widthPx, heightPx }
          // extract_frame       -> { outputUrl: "...", widthPx, heightPx, timestampSeconds }
          const v = val as { url?: string; outputUrl?: string } | null;
          return v?.outputUrl ?? v?.url ?? "";
        })
        .filter(Boolean);

      const validModels = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-2.5-pro", "gemini-flash-latest"];
      const resolvedModel = validModels.includes(llmData.model as string) ? llmData.model : "gemini-2.5-flash";

      const llmPayload: LLMTaskPayload = {
        workflowRunId, nodeRunId,
        model: resolvedModel as any,
        systemPrompt: llmData.systemPrompt ?? "",
        userMessage: connectedText ?? llmData.userMessage ?? "",
        imageUrls,
      };

      await prisma.nodeRun.update({
        where: { id: nodeRunId },
        data: { inputs: toJson(llmPayload) },
      });

      const handle = await tasks.triggerAndWait<typeof executeLLMNodeTask>("execute-llm-node", llmPayload);
      if (handle.ok) return handle.output;
      throw new Error(`LLM task failed: ${String(handle.error)}`);
    }

    case "crop_image": {
      const cropData = node.data as { x?: number; y?: number; width?: number; height?: number };
      const imageInput = resolvedInputs["image__0"] as { url?: string; outputUrl?: string } | string | undefined;
      const imageUrl = typeof imageInput === "string" ? imageInput : (imageInput?.url ?? imageInput?.outputUrl ?? "");
      if (!imageUrl) throw new Error("Crop image node: no image input provided");

      const cropPayload: CropImageTaskPayload = {
        workflowRunId, nodeRunId, imageUrl,
        x: cropData.x ?? 0, y: cropData.y ?? 0,
        width: cropData.width ?? 512, height: cropData.height ?? 512,
      };

      await prisma.nodeRun.update({ where: { id: nodeRunId }, data: { inputs: toJson(cropPayload) } });
      const handle = await tasks.triggerAndWait<typeof executeCropImageTask>("execute-crop-image-node", cropPayload);
      if (handle.ok) return handle.output;
      throw new Error(`Crop image task failed: ${String(handle.error)}`);
    }

    case "extract_frame": {
      const frameData = node.data as { timeOffsetSeconds?: number; outputFormat?: "jpg" | "png" | "webp" };
      const videoInput = resolvedInputs["video__0"] as { url?: string; uploadedUrl?: string } | string | undefined;
      const videoUrl = typeof videoInput === "string" ? videoInput : (videoInput?.url ?? videoInput?.uploadedUrl ?? "");
      if (!videoUrl) throw new Error("Extract frame node: no video input provided");

      const framePayload: ExtractFrameTaskPayload = {
        workflowRunId, nodeRunId, videoUrl,
        timeOffsetSeconds: frameData.timeOffsetSeconds ?? 0,
        outputFormat: frameData.outputFormat ?? "jpg",
      };

      await prisma.nodeRun.update({ where: { id: nodeRunId }, data: { inputs: toJson(framePayload) } });
      const handle = await tasks.triggerAndWait<typeof executeExtractFrameTask>("execute-extract-frame-node", framePayload);
      if (handle.ok) return handle.output;
      throw new Error(`Extract frame task failed: ${String(handle.error)}`);
    }

    default:
      throw new Error(`Unknown node type: ${(node as WorkflowNode).type}`);
  }
}

function nodeTypeToEnum(type: string): "TEXT" | "UPLOAD_IMAGE" | "UPLOAD_VIDEO" | "LLM" | "CROP_IMAGE" | "EXTRACT_FRAME" {
  const map: Record<string, "TEXT" | "UPLOAD_IMAGE" | "UPLOAD_VIDEO" | "LLM" | "CROP_IMAGE" | "EXTRACT_FRAME"> = {
    text: "TEXT", upload_image: "UPLOAD_IMAGE", upload_video: "UPLOAD_VIDEO",
    llm: "LLM", crop_image: "CROP_IMAGE", extract_frame: "EXTRACT_FRAME",
  };
  return map[type] ?? "TEXT";
}
