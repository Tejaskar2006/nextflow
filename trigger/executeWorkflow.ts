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
    const { workflowRunId, workflowId, scope, selectedNodeIds, nodeSnapshot } = payload;

    logger.log("Starting workflow execution", { workflowRunId, workflowId, scope });

    await prisma.workflowRun.update({
      where: { id: workflowRunId },
      data: { status: "RUNNING" },
    });

    const startMs = Date.now();

    try {
      const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });
      if (!workflow) throw new Error(`Workflow ${workflowId} not found`);

      // Prefer the live snapshot passed from the browser — it has the latest uploadedUrl.
      // Fall back to the DB copy if no snapshot was provided.
      const nodes = (nodeSnapshot?.nodes ?? workflow.nodes) as unknown as WorkflowNode[];
      const edges = (nodeSnapshot?.edges ?? workflow.edges) as unknown as WorkflowEdge[];
      console.log(`[WORKFLOW] Using ${nodeSnapshot ? "LIVE SNAPSHOT" : "DB copy"} for node data`);
      const uploadNodes = nodes.filter(n => n.type === "upload_image" || n.type === "upload_video");
      uploadNodes.forEach(n => console.log(`[WORKFLOW] Snapshot upload node:`, { type: n.type, uploadedUrl: (n.data as Record<string, unknown>).uploadedUrl ?? "(EMPTY)" }));

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

          const resolvedInputs = resultStore.getResolvedInputs(nodeId, nodes, edges);

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
      console.log(`[WORKFLOW] Upload node ${node.type}`, { uploadedUrl: url || "(EMPTY!)" });
      await prisma.nodeRun.update({
        where: { id: nodeRunId },
        data: { status: "SUCCESS", startedAt: new Date(), completedAt: new Date(), durationMs: 0, inputs: toJson(resolvedInputs), outputs: toJson({ url }) },
      });
      return { url };
    }

    case "llm": {
      const llmData = node.data as { model?: string; systemPrompt?: string; userMessage?: string };
      const connectedUserTextObj = resolvedInputs["text__0"] as { text?: string } | string | undefined;
      const connectedSystemTextObj = resolvedInputs["text__1"] as { text?: string } | string | undefined;

      const connectedUserText = typeof connectedUserTextObj === 'string' ? connectedUserTextObj : connectedUserTextObj?.text;
      const connectedSystemText = typeof connectedSystemTextObj === 'string' ? connectedSystemTextObj : connectedSystemTextObj?.text;

      console.log(`[WORKFLOW] LLM Node (${nodeRunId}) is resolving inputs...`);
      console.log(`[WORKFLOW] All input keys:`, Object.keys(resolvedInputs));

      const imageUrls: string[] = [];

      // Loop through ALL inputs to find anything that looks like an image/video URL
      for (const [key, val] of Object.entries(resolvedInputs)) {
        let detectedUrl = "";

        if (typeof val === "string" && (val.startsWith("http") || val.startsWith("data:image"))) {
          detectedUrl = val;
        } else if (val && typeof val === "object") {
          const v = val as Record<string, any>;
          detectedUrl = v.outputUrl || v.url || v.uploadedUrl || "";
        }

        // If it's a valid URL and the key looks like an image input (or it's from an upload node)
        if (detectedUrl && (key.startsWith("image__") || key.startsWith("video__") || key.includes("upload"))) {
          imageUrls.push(detectedUrl);
          console.log(`[WORKFLOW] Found image/video for LLM:`, { key, url: detectedUrl.slice(0, 50) + "..." });
        }
      }

      console.log(`[WORKFLOW] Total imageUrls for Gemini:`, imageUrls.length);

      if (imageUrls.length === 0) {
        console.warn(`[WORKFLOW] WARNING: No images found! Check your connections.`);
      }

      const validModels = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-2.5-pro", "gemini-flash-latest"];
      const resolvedModel = validModels.includes(llmData.model as string) ? llmData.model : "gemini-2.5-flash";

      const llmPayload: LLMTaskPayload = {
        workflowRunId, nodeRunId,
        model: resolvedModel as any,
        systemPrompt: connectedSystemText ?? llmData.systemPrompt ?? "",
        userMessage: connectedUserText ?? llmData.userMessage ?? "",
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
