// ============================================================
// TRIGGER.DEV TASK: execute-llm-node
// Calls Google Gemini with text + optional images.
// Updates NodeRun in PostgreSQL on completion.
// ============================================================

import { task, logger } from "@trigger.dev/sdk/v3";
import { generateWithGemini } from "@/lib/gemini";
import { prisma } from "@/lib/prisma";
import type { LLMTaskPayload, LLMTaskOutput } from "@/types/runs";

export const executeLLMNodeTask = task({
  id: "execute-llm-node",
  maxDuration: 120,
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 10000, // 10s delay between retries
    maxTimeoutInMs: 30000,
  },
  run: async (payload: LLMTaskPayload): Promise<LLMTaskOutput> => {
    const {
      nodeRunId,
      model,
      systemPrompt,
      userMessage,
      imageUrls,
    } = payload;

    logger.log("Starting LLM node execution", {
      nodeRunId,
      model,
      imageCount: imageUrls.length,
    });

    // Mark node as RUNNING
    await prisma.nodeRun.update({
      where: { id: nodeRunId },
      data: { status: "RUNNING", startedAt: new Date() },
    });

    const startMs = Date.now();

    try {
      const result = await generateWithGemini({
        model: model as Parameters<typeof generateWithGemini>[0]["model"],
        systemPrompt: systemPrompt || undefined,
        userMessage,
        imageUrls,
      });

      const durationMs = Date.now() - startMs;

      logger.log("LLM node completed", {
        nodeRunId,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        durationMs,
      });

      // Update NodeRun with success
      await prisma.nodeRun.update({
        where: { id: nodeRunId },
        data: {
          status: "SUCCESS",
          completedAt: new Date(),
          durationMs,
          outputs: {
            text: result.text,
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
          },
        },
      });

      return {
        text: result.text,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      };
    } catch (error) {
      const durationMs = Date.now() - startMs;
      const errMsg =
        error instanceof Error ? error.message : String(error);
      const errStack =
        error instanceof Error ? (error.stack ?? null) : null;

      logger.error("LLM node failed", { nodeRunId, error: errMsg });

      await prisma.nodeRun.update({
        where: { id: nodeRunId },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          durationMs,
          error: errMsg,
          errorStack: errStack,
        },
      });

      throw error; // Re-throw so Trigger.dev marks the run as failed
    }
  },
});
