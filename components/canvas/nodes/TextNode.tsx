"use client";

import { memo, useCallback } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { BaseNode, NodeField, NodeTextarea } from "./BaseNode";
import { useWorkflowStore } from "@/store/workflowStore";
import { encodeHandleId } from "@/types/nodes";
import type { TextNodeType } from "@/types/nodes";

export const TextNode = memo(function TextNode({ id, data, selected }: NodeProps<TextNodeType>) {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);

  const onChange = useCallback(
    (text: string) => updateNodeData<TextNodeType>(id, { text }),
    [id, updateNodeData]
  );

  const outputHandle = encodeHandleId({ portDataType: "text", portIndex: 0 });

  return (
    <div style={{ position: "relative" }}>
      <BaseNode
        id={id} label={data.label} icon="T"
        accentColor="var(--node-text)"
        status={data.status} errorMessage={data.errorMessage}
        selected={selected} minWidth={240}
      >
        <NodeField label="Text Content">
          <NodeTextarea
            id={`node-${id}-text`}
            value={data.text}
            onChange={onChange}
            placeholder="Enter text content…"
            rows={4}
          />
        </NodeField>

        {/* Output preview */}
        {data.outputText && (
          <div style={{
            marginTop: 8, padding: "7px 9px",
            background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)",
            borderRadius: 7, fontSize: 11, color: "var(--text-secondary)",
            lineHeight: 1.5, maxHeight: 80, overflow: "auto",
          }}>
            <span style={{ fontSize: 9, color: "var(--node-text)", fontWeight: 700, display: "block", marginBottom: 3 }}>OUTPUT</span>
            {data.outputText}
          </div>
        )}
      </BaseNode>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        id={outputHandle}
        data-handletype="text"
        style={{ right: -5, background: "var(--node-text)", border: "2px solid var(--bg-surface)" }}
      />
    </div>
  );
});
