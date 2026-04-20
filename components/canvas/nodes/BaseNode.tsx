"use client";

import { memo, type ReactNode } from "react";
import { type NodeExecutionStatus } from "@/types/nodes";
import { useWorkflowStore } from "@/store/workflowStore";

export interface BaseNodeProps {
  id: string;
  label: string;
  icon: string;
  accentColor: string;
  status: NodeExecutionStatus;
  errorMessage?: string;
  selected?: boolean;
  children: ReactNode;
  headerRight?: ReactNode;
  minWidth?: number;
}

function statusBorderColor(status: NodeExecutionStatus, accent: string): string {
  switch (status) {
    case "running": return "var(--purple-400)";
    case "success": return "var(--status-success)";
    case "failed":  return "var(--status-failed)";
    case "skipped": return "var(--status-skipped)";
    default: return accent + "40";
  }
}

function statusAnimation(status: NodeExecutionStatus): string | undefined {
  if (status === "running") return "nodeGlow 1.5s ease-in-out infinite";
  return undefined;
}

export const BaseNode = memo(function BaseNode({
  id, label, icon, accentColor, status, errorMessage,
  selected, children, headerRight, minWidth = 240,
}: BaseNodeProps) {
  const removeNode = useWorkflowStore((s) => s.removeNode);

  const borderColor = selected
    ? "var(--purple-400)"
    : statusBorderColor(status, accentColor);

  return (
    <div
      id={`node-${id}`}
      style={{
        minWidth,
        background: "var(--bg-surface)",
        border: `1px solid ${borderColor}`,
        borderRadius: 14,
        overflow: "hidden",
        boxShadow: selected
          ? `0 0 0 2px var(--purple-glow-sm), 0 8px 32px rgba(0,0,0,0.5)`
          : `0 4px 24px rgba(0,0,0,0.4)`,
        animation: statusAnimation(status),
        transition: "border-color 0.2s, box-shadow 0.2s",
        position: "relative",
      }}
    >
      {/* Top color stripe */}
      <div style={{
        height: 3,
        background: `linear-gradient(90deg, ${accentColor}, ${accentColor}80)`,
      }} />

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 12px 8px",
        borderBottom: "1px solid var(--border-subtle)",
        background: `linear-gradient(180deg, ${accentColor}0d 0%, transparent 100%)`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{
            width: 22, height: 22, borderRadius: 6,
            background: `${accentColor}20`,
            border: `1px solid ${accentColor}40`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12,
          }}>
            {icon}
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "0.1px" }}>
            {label}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <StatusDot status={status} />
          {headerRight}
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeNode(id);
            }}
            style={{
              background: "transparent", border: "none", cursor: "pointer",
              fontSize: 14, color: "var(--text-disabled)", display: "flex",
              alignItems: "center", justifyContent: "center", padding: 2,
              borderRadius: 4, transition: "color 0.2s, background 0.2s"
            }}
            title="Delete Node"
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--status-failed)"; e.currentTarget.style.background = "rgba(239,68,68,0.1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-disabled)"; e.currentTarget.style.background = "transparent"; }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "12px" }}>
        {children}
      </div>

      {/* Error footer */}
      {status === "failed" && errorMessage && (
        <div style={{
          padding: "7px 12px",
          borderTop: "1px solid rgba(239,68,68,0.2)",
          background: "rgba(239,68,68,0.07)",
          fontSize: 10, color: "var(--status-failed)",
          lineHeight: 1.4,
        }}>
          ⚠ {errorMessage.slice(0, 120)}
        </div>
      )}

      {/* Running pulse ring */}
      {status === "running" && (
        <div style={{
          position: "absolute", inset: -3,
          borderRadius: 17, border: "2px solid var(--purple-400)",
          opacity: 0, animation: "pulseRing 1.5s ease-out infinite",
          pointerEvents: "none",
        }} />
      )}
    </div>
  );
});

function StatusDot({ status }: { status: NodeExecutionStatus }) {
  const colors: Record<NodeExecutionStatus, string> = {
    idle:    "var(--text-disabled)",
    pending: "var(--status-pending)",
    running: "#f59e0b",
    success: "var(--status-success)",
    failed:  "var(--status-failed)",
    skipped: "var(--status-skipped)",
  };
  const color = colors[status];
  return (
    <div style={{
      width: 7, height: 7, borderRadius: "50%",
      background: color,
      boxShadow: status === "running" ? `0 0 6px ${color}` : status === "success" ? `0 0 6px ${color}` : "none",
      animation: status === "running" ? "pulseRing 1s ease-out infinite" : "none",
    }} />
  );
}

// ────────────────────────────────────────────────────────────
// Shared styled input / textarea for use inside nodes
// ────────────────────────────────────────────────────────────
export function NodeInput({
  id, value, onChange, placeholder, disabled, type = "text",
}: {
  id: string; value: string; onChange: (v: string) => void;
  placeholder?: string; disabled?: boolean; type?: string;
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      style={{
        width: "100%", background: disabled ? "var(--bg-canvas)" : "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)", borderRadius: 7,
        color: disabled ? "var(--text-disabled)" : "var(--text-primary)",
        fontSize: 12, padding: "6px 9px", outline: "none",
        fontFamily: "inherit",
        transition: "border-color 0.15s",
      }}
      onFocus={(e) => { if (!disabled) e.currentTarget.style.borderColor = "var(--border-purple)"; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-subtle)"; }}
    />
  );
}

export function NodeTextarea({
  id, value, onChange, placeholder, disabled, rows = 3,
}: {
  id: string; value: string; onChange: (v: string) => void;
  placeholder?: string; disabled?: boolean; rows?: number;
}) {
  return (
    <textarea
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      rows={rows}
      style={{
        width: "100%", background: disabled ? "var(--bg-canvas)" : "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)", borderRadius: 7,
        color: disabled ? "var(--text-disabled)" : "var(--text-primary)",
        fontSize: 12, padding: "7px 9px", outline: "none", resize: "vertical",
        fontFamily: "inherit", lineHeight: 1.5,
        transition: "border-color 0.15s",
      }}
      onFocus={(e) => { if (!disabled) e.currentTarget.style.borderColor = "var(--border-purple)"; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-subtle)"; }}
    />
  );
}

export function NodeLabel({ children }: { children: ReactNode }) {
  return (
    <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.5px", textTransform: "uppercase", display: "block", marginBottom: 4 }}>
      {children}
    </label>
  );
}

export function NodeField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <NodeLabel>{label}</NodeLabel>
      {children}
    </div>
  );
}

export function ConnectedBadge() {
  return (
    <span style={{ fontSize: 9, color: "var(--purple-400)", background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)", borderRadius: 4, padding: "1px 5px", fontWeight: 600 }}>
      CONNECTED
    </span>
  );
}
