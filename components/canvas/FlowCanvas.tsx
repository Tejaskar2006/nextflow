"use client";

import { useCallback, useMemo } from "react";
import {
  ReactFlow, Background, BackgroundVariant,
  Controls, MiniMap, Panel,
  ReactFlowProvider,
  useReactFlow,
  type IsValidConnection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useWorkflowStore } from "@/store/workflowStore";
import { validateConnection } from "@/lib/dag/validator";
import type { WorkflowNode } from "@/types/nodes";
import { CustomEdge } from "./CustomEdge";
import { TextNode } from "./nodes/TextNode";
import { UploadImageNode } from "./nodes/UploadImageNode";
import { UploadVideoNode } from "./nodes/UploadVideoNode";
import { LLMNode } from "./nodes/LLMNode";
import { CropImageNode } from "./nodes/CropImageNode";
import { ExtractFrameNode } from "./nodes/ExtractFrameNode";

// Stable references — MUST be defined outside component
const nodeTypes = {
  text: TextNode,
  upload_image: UploadImageNode,
  upload_video: UploadVideoNode,
  llm: LLMNode,
  crop_image: CropImageNode,
  extract_frame: ExtractFrameNode,
};

const edgeTypes = { custom: CustomEdge };

interface FlowCanvasProps {
  workflowId: string;
  onExecute: (scope: "FULL" | "SELECTED", selectedIds?: string[]) => Promise<void>;
}

// ── Public export: wraps with the required ReactFlowProvider
export function FlowCanvas(props: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function FlowCanvasInner({ onExecute }: FlowCanvasProps) {
  const {
    nodes, edges, viewport,
    onNodesChange, onEdgesChange, onConnect,
    setViewport, setSelectedNodeIds, selectedNodeIds,
    undo, redo, canUndo, canRedo,
  } = useWorkflowStore();

  const { screenToFlowPosition } = useReactFlow();

  // ── Type-safe connection validator
  const isValidConnection = useCallback<IsValidConnection>(
    (connection) => {
      const state = useWorkflowStore.getState();
      const result = validateConnection(
        {
          source: connection.source,
          target: connection.target,
          sourceHandle: connection.sourceHandle ?? null,
          targetHandle: connection.targetHandle ?? null,
          sourceNodeType: state.nodes.find((n) => n.id === connection.source)?.type ?? "",
          targetNodeType: state.nodes.find((n) => n.id === connection.target)?.type ?? "",
        },
        state.nodes,
        state.edges
      );
      return result.valid;
    },
    []
  );

  // ── Handle drag-over for drop-to-add
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  // ── Drop handler: add node at cursor
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const nodeType = event.dataTransfer.getData("application/nextflow-node-type");
      if (!nodeType) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      useWorkflowStore.getState().addNode(
        nodeType as WorkflowNode["type"],
        position
      );
    },
    [screenToFlowPosition]
  );

  const handleSelectionChange = useCallback(
    ({ nodes: selected }: { nodes: Array<{ id: string }> }) => {
      setSelectedNodeIds(selected.map((n) => n.id));
    },
    [setSelectedNodeIds]
  );

  const defaultEdgeOptions = useMemo(
    () => ({
      type: "custom",
      animated: false,
    }),
    []
  );

  return (
    <div style={{ flex: 1, position: "relative" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onSelectionChange={handleSelectionChange}
        isValidConnection={isValidConnection}
        onDragOver={onDragOver}
        onDrop={onDrop}
        defaultEdgeOptions={defaultEdgeOptions}
        defaultViewport={viewport}
        onMoveEnd={(_, vp) => setViewport(vp)}
        minZoom={0.1}
        maxZoom={2}
        snapToGrid
        snapGrid={[12, 12]}
        deleteKeyCode={["Delete", "Backspace"]}
        multiSelectionKeyCode="Shift"
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        style={{ background: "var(--bg-canvas)" }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.5}
          color="rgba(255,255,255,0.1)"
        />
        <Controls
          style={{ bottom: 24, left: 24 }}
          showInteractive={false}
        />
        <MiniMap
          style={{ bottom: 24, right: 320, borderRadius: 10 }}
          nodeColor={minimapNodeColor}
          maskColor="rgba(10,10,15,0.7)"
        />

        {/* Run Selected panel */}
        {selectedNodeIds.length > 0 && (
          <Panel position="top-center">
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              background: "var(--bg-surface)", border: "1px solid var(--border-purple)",
              borderRadius: 10, padding: "8px 16px",
              boxShadow: "0 8px 32px rgba(124,58,237,0.2)",
              animation: "fadeIn 0.2s ease",
            }}>
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {selectedNodeIds.length} node{selectedNodeIds.length > 1 ? "s" : ""} selected
              </span>
              <button
                id="run-selected-btn"
                onClick={() => void onExecute("SELECTED", selectedNodeIds)}
                style={{
                  background: "linear-gradient(135deg,#7c3aed,#6d28d9)",
                  color: "#fff", border: "none", borderRadius: 7,
                  padding: "5px 14px", fontSize: 12, fontWeight: 600,
                  cursor: "pointer", boxShadow: "0 0 12px rgba(124,58,237,0.3)",
                }}
              >
                ▶ Run Selected
              </button>
            </div>
          </Panel>
        )}

        {/* History (Undo/Redo) panel */}
        <Panel position="bottom-center">
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "var(--bg-surface)", border: "1px solid var(--border-default)",
            borderRadius: 8, padding: "6px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            marginBottom: 16
          }}>
            <button
              onClick={undo}
              disabled={!canUndo}
              style={{
                background: canUndo ? "var(--bg-elevated)" : "transparent",
                color: canUndo ? "var(--text-primary)" : "var(--text-disabled)",
                border: "none", borderRadius: 6, padding: "6px 12px",
                fontSize: 12, fontWeight: 600, cursor: canUndo ? "pointer" : "not-allowed",
                transition: "background 0.2s, color 0.2s"
              }}
              title="Undo (Ctrl+Z)"
            >
              ↩ Undo
            </button>
            <div style={{ width: 1, height: 16, background: "var(--border-subtle)" }} />
            <button
              onClick={redo}
              disabled={!canRedo}
              style={{
                background: canRedo ? "var(--bg-elevated)" : "transparent",
                color: canRedo ? "var(--text-primary)" : "var(--text-disabled)",
                border: "none", borderRadius: 6, padding: "6px 12px",
                fontSize: 12, fontWeight: 600, cursor: canRedo ? "pointer" : "not-allowed",
                transition: "background 0.2s, color 0.2s"
              }}
              title="Redo (Ctrl+Y)"
            >
              ↪ Redo
            </button>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}

function minimapNodeColor(node: { type?: string }) {
  const map: Record<string, string> = {
    text: "#3b82f6",
    upload_image: "#10b981",
    upload_video: "#f59e0b",
    llm: "#8b5cf6",
    crop_image: "#06b6d4",
    extract_frame: "#f97316",
  };
  return map[node.type ?? ""] ?? "#5a5a7a";
}
