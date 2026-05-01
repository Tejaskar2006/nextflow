"use client";

import { memo, useCallback } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { BaseNode, NodeField, NodeInput, ConnectedBadge } from "./BaseNode";
import { useWorkflowStore } from "@/store/workflowStore";
import { encodeHandleId } from "@/types/nodes";
import type { ExtractFrameNodeType } from "@/types/nodes";

export const ExtractFrameNode = memo(function ExtractFrameNode({ id, data, selected }: NodeProps<ExtractFrameNodeType>) {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);

  const set = useCallback(
    <K extends keyof ExtractFrameNodeType["data"]>(key: K, value: ExtractFrameNodeType["data"][K]) =>
      updateNodeData<ExtractFrameNodeType>(id, { [key]: value } as Partial<ExtractFrameNodeType["data"]>),
    [id, updateNodeData]
  );

  const inputHandle  = encodeHandleId({ portDataType: "video", portIndex: 0 });
  const outputHandle = encodeHandleId({ portDataType: "image", portIndex: 0 });

  return (
    <div style={{ position: "relative" }}>
      <Handle type="target" position={Position.Left} id={inputHandle} data-handletype="video"
        style={{ left: -5, background: "var(--node-video)", border: "2px solid var(--bg-surface)" }} />

      <BaseNode
        id={id} label={data.label} icon="🎞"
        accentColor="var(--node-frame)"
        status={data.status} errorMessage={data.errorMessage}
        selected={selected} minWidth={240}
      >
        {data.videoInputConnected && (
          <div style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <ConnectedBadge />
            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Video input connected</span>
          </div>
        )}

        <NodeField label="Time Offset (seconds)">
          <NodeInput id={`node-${id}-time`} type="number" value={String(data.timeOffsetSeconds)}
            onChange={(v) => set("timeOffsetSeconds", Math.max(0, Number(v)))} placeholder="0" />
        </NodeField>

        <NodeField label="Output Format">
          <select
            id={`node-${id}-format`}
            value={data.outputFormat}
            onChange={(e) => set("outputFormat", e.target.value as "jpg" | "png" | "webp")}
            style={{
              width: "100%", background: "var(--bg-elevated)",
              border: "1px solid var(--border-subtle)", borderRadius: 7,
              color: "var(--text-primary)", fontSize: 12, padding: "6px 9px",
              cursor: "pointer", outline: "none",
            }}
          >
            <option value="jpg">JPEG</option>
            <option value="png">PNG</option>
            <option value="webp">WebP</option>
          </select>
        </NodeField>

        <NodeField label="Output Filename (Optional)">
          <NodeInput id={`node-${id}-filename`} type="text" value={data.outputFileName || ""}
            onChange={(v) => set("outputFileName", v)} placeholder="frame-1" />
        </NodeField>

        {/* Output preview */}
        {data.outputUrl && (
          <div style={{ marginTop: 4 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={data.outputUrl} alt="Extracted frame"
              style={{ width: "100%", height: 90, objectFit: "cover", borderRadius: 7, display: "block", border: "1px solid rgba(249,115,22,0.3)" }} />
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
              Frame @ {data.timeOffsetSeconds}s
            </div>
          </div>
        )}
      </BaseNode>

      {/* Output is IMAGE (extracted frame) */}
      <Handle type="source" position={Position.Right} id={outputHandle} data-handletype="image"
        style={{ right: -5, background: "var(--node-frame)", border: "2px solid var(--bg-surface)" }} />
    </div>
  );
});
