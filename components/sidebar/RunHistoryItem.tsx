"use client";

import { formatRelativeTime, formatDuration } from "@/lib/utils";
import type { WorkflowRunRecord } from "@/types/runs";

interface RunHistoryItemProps {
  run: WorkflowRunRecord;
  isSelected: boolean;
  onClick: () => void;
  onDelete?: () => void;
}

const STATUS_CONFIG = {
  PENDING: { color: "var(--status-pending)", label: "Pending",  dot: "⬤" },
  RUNNING: { color: "var(--status-running)", label: "Running",  dot: "⬤" },
  SUCCESS: { color: "var(--status-success)", label: "Success",  dot: "⬤" },
  FAILED:  { color: "var(--status-failed)",  label: "Failed",   dot: "⬤" },
  PARTIAL: { color: "#f97316",               label: "Partial",  dot: "⬤" },
} as const;

const SCOPE_LABELS = {
  FULL:     "Full run",
  SINGLE:   "Single node",
  SELECTED: "Selected nodes",
};

export function RunHistoryItem({ run, isSelected, onClick, onDelete }: RunHistoryItemProps) {
  const cfg = STATUS_CONFIG[run.status] ?? STATUS_CONFIG.PENDING;
  const nodeCount = run.nodeRuns?.length ?? 0;
  const successCount = run.nodeRuns?.filter((n) => n.status === "SUCCESS").length ?? 0;

  return (
    <div
      id={`run-item-${run.id}`}
      onClick={onClick}
      style={{
        padding: "10px 12px", borderRadius: 9, marginBottom: 4, cursor: "pointer",
        background: isSelected ? "var(--bg-elevated)" : "transparent",
        border: `1px solid ${isSelected ? "var(--border-purple)" : "transparent"}`,
        transition: "all 0.15s",
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          (e.currentTarget as HTMLDivElement).style.background = "var(--bg-elevated)";
          (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-default)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          (e.currentTarget as HTMLDivElement).style.background = "transparent";
          (e.currentTarget as HTMLDivElement).style.borderColor = "transparent";
        }
      }}
    >
      {/* Row 1: status + time + delete */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 7, color: cfg.color, animation: run.status === "RUNNING" ? "pulseRing 1s ease-out infinite" : "none" }}>
            {cfg.dot}
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: cfg.color }}>
            {cfg.label}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
            {formatRelativeTime(run.startedAt)}
          </span>
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              style={{
                width: 20, height: 20, borderRadius: 4, background: "transparent",
                border: "none", color: "var(--text-disabled)", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "color 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--status-failed)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-disabled)")}
              title="Delete run"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Row 2: scope + duration */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{
          fontSize: 9, color: "var(--text-muted)",
          background: "var(--bg-canvas)", border: "1px solid var(--border-subtle)",
          borderRadius: 4, padding: "1px 5px",
        }}>
          {SCOPE_LABELS[run.scope]}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {nodeCount > 0 && (
            <span style={{ fontSize: 9, color: "var(--text-muted)" }}>
              {successCount}/{nodeCount} nodes
            </span>
          )}
          {run.durationMs != null && (
            <span style={{ fontSize: 9, color: "var(--text-muted)" }}>
              {formatDuration(run.durationMs)}
            </span>
          )}
        </div>
      </div>

      {run.error && (
        <div style={{ marginTop: 5, fontSize: 10, color: "var(--status-failed)", lineHeight: 1.3 }}>
          ⚠ {run.error.slice(0, 80)}
        </div>
      )}
    </div>
  );
}
