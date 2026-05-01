"use client";

import { useCallback, useState } from "react";
import { useWorkflowStore } from "@/store/workflowStore";
import type { WorkflowNode } from "@/types/nodes";

interface NodeTypeConfig {
  type: WorkflowNode["type"];
  label: string;
  icon: string;
  description: string;
  accent: string;
}

const NODE_TYPES: NodeTypeConfig[] = [
  { type: "text",          label: "Text",          icon: "T",  description: "Static text content",        accent: "var(--node-text)"  },
  { type: "upload_image",  label: "Upload Image",  icon: "🖼", description: "Image via Transloadit",      accent: "var(--node-image)" },
  { type: "upload_video",  label: "Upload Video",  icon: "🎬", description: "Video via Transloadit",      accent: "var(--node-video)" },
  { type: "llm",           label: "LLM (Gemini)",  icon: "🧠", description: "AI inference + vision",      accent: "var(--node-llm)"   },
  { type: "crop_image",    label: "Crop Image",    icon: "✂️", description: "FFmpeg image crop",          accent: "var(--node-crop)"  },
  { type: "extract_frame", label: "Extract Frame", icon: "🎞", description: "FFmpeg frame extraction",    accent: "var(--node-frame)" },
];

interface LeftSidebarProps {
  onExecute: (scope: "FULL" | "SELECTED", ids?: string[]) => Promise<void>;
}

export function LeftSidebar({ onExecute }: LeftSidebarProps) {
  const [isOpen, setIsOpen] = useState(true);
  const { addNode, selectedNodeIds, isExecuting, clearExecutionState } = useWorkflowStore();

  const handleDragStart = useCallback((e: React.DragEvent, type: WorkflowNode["type"]) => {
    e.dataTransfer.setData("application/nextflow-node-type", type);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleClick = useCallback((type: WorkflowNode["type"]) => {
    // Add at a semi-random position so stacks don't overlap
    const x = 200 + Math.random() * 200;
    const y = 100 + Math.random() * 300;
    addNode(type, { x, y });
  }, [addNode]);

  return (
    <aside style={{
      width: isOpen ? "var(--sidebar-left)" : "48px",
      minWidth: isOpen ? "var(--sidebar-left)" : "48px",
      background: "var(--bg-surface)",
      borderRight: "1px solid var(--border-subtle)",
      display: "flex", flexDirection: "column",
      overflowY: "hidden", zIndex: 10,
      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    }}>
      {/* Toggle Button */}
      <div style={{ display: "flex", justifyContent: isOpen ? "flex-end" : "center", padding: "12px", borderBottom: "1px solid var(--border-subtle)" }}>
        <button onClick={() => setIsOpen(!isOpen)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "4px", borderRadius: "6px" }} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
          {isOpen ? "◀" : "▶"}
        </button>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto", opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? "auto" : "none", transition: "opacity 0.2s" }}>
        {/* Header */}
        <div style={{ padding: "16px 16px 10px", borderBottom: "1px solid var(--border-subtle)" }}>
          <h2 style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.8px", textTransform: "uppercase" }}>
            Node Library
          </h2>
          <p style={{ fontSize: 10, color: "var(--text-disabled)", marginTop: 3 }}>
            Drag to canvas or click to add
          </p>
        </div>

        {/* Node buttons */}
        <div style={{ padding: "10px 10px", display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
          {NODE_TYPES.map((nt) => (
            <div
              key={nt.type}
              id={`sidebar-node-${nt.type}`}
              draggable
              onDragStart={(e) => handleDragStart(e, nt.type)}
              onClick={() => handleClick(nt.type)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", borderRadius: 9,
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-subtle)",
                cursor: "grab", userSelect: "none",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = nt.accent + "60";
                (e.currentTarget as HTMLDivElement).style.background = "var(--bg-overlay)";
                (e.currentTarget as HTMLDivElement).style.transform = "translateX(2px)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-subtle)";
                (e.currentTarget as HTMLDivElement).style.background = "var(--bg-elevated)";
                (e.currentTarget as HTMLDivElement).style.transform = "none";
              }}
            >
              <div style={{
                width: 30, height: 30, borderRadius: 7, flexShrink: 0,
                background: `${nt.accent}20`, border: `1px solid ${nt.accent}40`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14,
              }}>
                {nt.icon}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.2 }}>
                  {nt.label}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", lineHeight: 1.3 }}>
                  {nt.description}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Execute controls */}
        <div style={{ padding: "12px 10px", borderTop: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", gap: 6 }}>
          {selectedNodeIds.length > 0 && (
            <button
              id="sidebar-run-selected"
              onClick={() => void onExecute("SELECTED", selectedNodeIds)}
              disabled={isExecuting}
              style={{
                width: "100%", padding: "9px", borderRadius: 8,
                background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.35)",
                color: "var(--purple-300)", fontSize: 12, fontWeight: 600,
                cursor: isExecuting ? "not-allowed" : "pointer",
                transition: "all 0.15s",
              }}
            >
              ▶ Run Selected ({selectedNodeIds.length})
            </button>
          )}
          <button
            id="sidebar-clear-state"
            onClick={clearExecutionState}
            style={{
              width: "100%", padding: "8px", borderRadius: 8,
              background: "transparent", border: "1px solid var(--border-subtle)",
              color: "var(--text-muted)", fontSize: 11, cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-default)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-subtle)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)"; }}
          >
            ↺ Clear State
          </button>
        </div>
      </div>
    </aside>
  );
}
