"use client";

import { memo, useCallback } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { BaseNode, NodeField, NodeInput, ConnectedBadge } from "./BaseNode";
import { useWorkflowStore } from "@/store/workflowStore";
import { encodeHandleId } from "@/types/nodes";
import type { CropImageNodeType } from "@/types/nodes";

export const CropImageNode = memo(function CropImageNode({ id, data, selected }: NodeProps<CropImageNodeType>) {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);

  const set = useCallback(
    <K extends keyof CropImageNodeType["data"]>(key: K, value: CropImageNodeType["data"][K]) =>
      updateNodeData<CropImageNodeType>(id, { [key]: value } as Partial<CropImageNodeType["data"]>),
    [id, updateNodeData]
  );

  const inputHandle  = encodeHandleId({ portDataType: "image", portIndex: 0 });
  const outputHandle = encodeHandleId({ portDataType: "image", portIndex: 0 });

  return (
    <div style={{ position: "relative" }}>
      <Handle type="target" position={Position.Left} id={inputHandle} data-handletype="image"
        style={{ left: -5, background: "var(--node-image)", border: "2px solid var(--bg-surface)" }} />

      <BaseNode
        id={id} label={data.label} icon="✂️"
        accentColor="var(--node-crop)"
        status={data.status} errorMessage={data.errorMessage}
        selected={selected} minWidth={240}
      >
        {data.imageInputConnected && (
          <div style={{ marginBottom: 10 }}>
            <ConnectedBadge />
            <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 6 }}>Image input connected</span>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <NodeField label="X (px)">
            <NodeInput id={`node-${id}-x`} type="number" value={String(data.x)}
              onChange={(v) => set("x", Number(v))} placeholder="0" />
          </NodeField>
          <NodeField label="Y (px)">
            <NodeInput id={`node-${id}-y`} type="number" value={String(data.y)}
              onChange={(v) => set("y", Number(v))} placeholder="0" />
          </NodeField>
          <NodeField label="Width (px)">
            <NodeInput id={`node-${id}-w`} type="number" value={String(data.width)}
              onChange={(v) => set("width", Number(v))} placeholder="512" />
          </NodeField>
          <NodeField label="Height (px)">
            <NodeInput id={`node-${id}-h`} type="number" value={String(data.height)}
              onChange={(v) => set("height", Number(v))} placeholder="512" />
          </NodeField>
        </div>

        {/* Output preview */}
        {data.outputUrl && (
          <div style={{ marginTop: 8 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={data.outputUrl} alt="Cropped output"
              style={{ width: "100%", height: 90, objectFit: "cover", borderRadius: 7, display: "block", border: "1px solid rgba(6,182,212,0.3)" }} />
          </div>
        )}
      </BaseNode>

      <Handle type="source" position={Position.Right} id={outputHandle} data-handletype="image"
        style={{ right: -5, background: "var(--node-crop)", border: "2px solid var(--bg-surface)" }} />
    </div>
  );
});
