"use client";

import { memo, useCallback } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { BaseNode, NodeField, NodeTextarea, ConnectedBadge } from "./BaseNode";
import { useWorkflowStore } from "@/store/workflowStore";
import { encodeHandleId } from "@/types/nodes";
import type { LLMNodeType, GeminiModel } from "@/types/nodes";

const MODELS: { value: GeminiModel; label: string }[] = [
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
  { value: "gemini-flash-latest", label: "Gemini Flash Latest" },
];

export const LLMNode = memo(function LLMNode({ id, data, selected }: NodeProps<LLMNodeType>) {

  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);

  const set = useCallback(
    <K extends keyof LLMNodeType["data"]>(key: K, value: LLMNodeType["data"][K]) =>
      updateNodeData<LLMNodeType>(id, { [key]: value } as Partial<LLMNodeType["data"]>),
    [id, updateNodeData]
  );

  const userTextInputHandle = encodeHandleId({ portDataType: "text", portIndex: 0 });
  const systemTextInputHandle = encodeHandleId({ portDataType: "text", portIndex: 1 });
  const image0Handle = encodeHandleId({ portDataType: "image", portIndex: 0 });
  const image1Handle = encodeHandleId({ portDataType: "image", portIndex: 1 });
  const image2Handle = encodeHandleId({ portDataType: "image", portIndex: 2 });
  const outputHandle = encodeHandleId({ portDataType: "text", portIndex: 0 });

  return (
    <div style={{ position: "relative" }}>
      {/* Text input handles */}
      <Handle type="target" position={Position.Left} id={userTextInputHandle} data-handletype="text"
        style={{ left: -5, top: "54%", background: "var(--node-text)", border: "2px solid var(--bg-surface)" }} />
      <Handle type="target" position={Position.Left} id={systemTextInputHandle} data-handletype="text"
        style={{ left: -5, top: "36%", background: "var(--node-text)", border: "2px solid var(--bg-surface)" }} />
      {/* Image input handles (3 slots) */}
      <Handle type="target" position={Position.Left} id={image0Handle} data-handletype="image"
        style={{ left: -5, top: "68%", background: "var(--node-image)", border: "2px solid var(--bg-surface)" }} />
      <Handle type="target" position={Position.Left} id={image1Handle} data-handletype="image"
        style={{ left: -5, top: "78%", background: "var(--node-image)", border: "2px solid var(--bg-surface)" }} />
      <Handle type="target" position={Position.Left} id={image2Handle} data-handletype="image"
        style={{ left: -5, top: "88%", background: "var(--node-image)", border: "2px solid var(--bg-surface)" }} />

      <BaseNode
        id={id} label={data.label} icon="🧠"
        accentColor="var(--node-llm)"
        status={data.status} errorMessage={data.errorMessage}
        selected={selected} minWidth={280}
        headerRight={
          <select
            id={`node-${id}-model`}
            value={data.model}
            onChange={(e) => set("model", e.target.value as GeminiModel)}
            style={{
              background: "var(--bg-elevated)", color: "var(--text-secondary)",
              border: "1px solid var(--border-subtle)", borderRadius: 5,
              fontSize: 10, padding: "2px 4px", cursor: "pointer",
            }}
          >
            {MODELS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        }
      >
        {/* System prompt */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.5px", textTransform: "uppercase" }}>
              System Prompt
            </label>
            {data.systemPromptConnected && <ConnectedBadge />}
          </div>
          <NodeTextarea
            id={`node-${id}-system`}
            value={data.systemPrompt}
            onChange={(v) => set("systemPrompt", v)}
            placeholder={data.systemPromptConnected ? "Receiving from connected node…" : "You are a helpful assistant…"}
            disabled={data.systemPromptConnected}
            rows={2}
          />
        </div>

        {/* User message */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.5px", textTransform: "uppercase" }}>
              User Message
            </label>
            {data.userMessageConnected && <ConnectedBadge />}
          </div>
          <NodeTextarea
            id={`node-${id}-user`}
            value={data.userMessage}
            onChange={(v) => set("userMessage", v)}
            placeholder={data.userMessageConnected ? "Receiving from connected node…" : "Enter your prompt…"}
            disabled={data.userMessageConnected}
            rows={3}
          />
        </div>

        {/* Image inputs indicator */}
        {data.imageInputsConnected && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: "var(--node-image)", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 6, padding: "4px 8px" }}>
              🖼 Vision mode active
            </div>
          </div>
        )}

        {/* Output */}
        {data.outputText && (
          <div style={{ padding: "8px", background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)", borderRadius: 7 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 9, color: "var(--node-llm)", fontWeight: 700 }}>OUTPUT</span>
              {data.inputTokens && (
                <span style={{ fontSize: 9, color: "var(--text-muted)" }}>
                  {data.inputTokens}↑ / {data.outputTokens}↓ tokens
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.5, maxHeight: 100, overflow: "auto" }}>
              {data.outputText}
            </div>
          </div>
        )}
      </BaseNode>

      {/* Text output handle */}
      <Handle type="source" position={Position.Right} id={outputHandle} data-handletype="text"
        style={{ right: -5, background: "var(--node-llm)", border: "2px solid var(--bg-surface)" }} />
    </div>
  );
});
