"use client";

import { formatDuration, formatRelativeTime } from "@/lib/utils";
import type { WorkflowRunRecord, NodeRunRecord } from "@/types/runs";

interface NodeRunBreakdownProps {
  run: WorkflowRunRecord;
}

const NODE_TYPE_ICONS: Record<string, string> = {
  TEXT: "T", UPLOAD_IMAGE: "🖼", UPLOAD_VIDEO: "🎬",
  LLM: "🧠", CROP_IMAGE: "✂️", EXTRACT_FRAME: "🎞",
};

const STATUS_CONFIG = {
  PENDING: { color: "var(--status-pending)", label: "Pending"  },
  RUNNING: { color: "var(--status-running)", label: "Running"  },
  SUCCESS: { color: "var(--status-success)", label: "Success"  },
  FAILED:  { color: "var(--status-failed)",  label: "Failed"   },
  SKIPPED: { color: "var(--status-skipped)", label: "Skipped"  },
} as const;

export function NodeRunBreakdown({ run }: NodeRunBreakdownProps) {
  return (
    <div>
      {/* Run summary */}
      <div style={{
        padding: "10px 12px", borderRadius: 9, marginBottom: 12,
        background: "var(--bg-elevated)", border: "1px solid var(--border-default)",
      }}>
        <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.5px" }}>
          Run Summary
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 0", fontSize: 11 }}>
          <span style={{ color: "var(--text-muted)" }}>Started</span>
          <span style={{ color: "var(--text-secondary)", textAlign: "right" }}>{formatRelativeTime(run.startedAt)}</span>
          {run.durationMs != null && (
            <>
              <span style={{ color: "var(--text-muted)" }}>Duration</span>
              <span style={{ color: "var(--text-secondary)", textAlign: "right" }}>{formatDuration(run.durationMs)}</span>
            </>
          )}
          <span style={{ color: "var(--text-muted)" }}>Scope</span>
          <span style={{ color: "var(--text-secondary)", textAlign: "right" }}>{run.scope}</span>
          <span style={{ color: "var(--text-muted)" }}>Nodes</span>
          <span style={{ color: "var(--text-secondary)", textAlign: "right" }}>{run.nodeRuns?.length ?? 0}</span>
        </div>
      </div>

      {/* Node runs */}
      <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 8 }}>
        Node Breakdown
      </div>

      {(!run.nodeRuns || run.nodeRuns.length === 0) ? (
        <p style={{ fontSize: 11, color: "var(--text-disabled)", textAlign: "center", padding: "20px 0" }}>
          No node runs recorded.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {run.nodeRuns.map((nr) => (
            <NodeRunCard key={nr.id} nodeRun={nr} />
          ))}
        </div>
      )}
    </div>
  );
}

function NodeRunCard({ nodeRun }: { nodeRun: NodeRunRecord }) {
  const cfg = STATUS_CONFIG[nodeRun.status] ?? STATUS_CONFIG.PENDING;
  const icon = NODE_TYPE_ICONS[nodeRun.nodeType] ?? "?";
  const outputs = nodeRun.outputs as Record<string, unknown>;

  return (
    <details
      id={`noderun-${nodeRun.id}`}
      style={{
        background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
        borderRadius: 8, overflow: "hidden",
      }}
    >
      <summary style={{
        padding: "9px 12px", cursor: "pointer", display: "flex",
        alignItems: "center", gap: 8, listStyle: "none", userSelect: "none",
      }}>
        <span style={{ fontSize: 12 }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {nodeRun.nodeLabel ?? nodeRun.nodeType}
          </div>
          <div style={{ fontSize: 9, color: "var(--text-muted)" }}>
            {nodeRun.nodeType}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
          {nodeRun.durationMs != null && (
            <span style={{ fontSize: 9, color: "var(--text-muted)" }}>{formatDuration(nodeRun.durationMs)}</span>
          )}
        </div>
      </summary>

      <div style={{ padding: "0 12px 10px", borderTop: "1px solid var(--border-subtle)" }}>
        {/* Outputs */}
        {Object.keys(outputs).length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 5 }}>
              Outputs
            </div>
            {/* Text output */}
            {typeof outputs["text"] === "string" && (
              <div style={{ fontSize: 11, color: "var(--text-secondary)", background: "var(--bg-canvas)", borderRadius: 6, padding: "6px 8px", lineHeight: 1.4, maxHeight: 100, overflow: "auto" }}>
                {outputs["text"]}
              </div>
            )}
            {/* Image output */}
            {typeof outputs["outputUrl"] === "string" && outputs["outputUrl"].startsWith("data:image") && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={outputs["outputUrl"]} alt="Node output" style={{ width: "100%", borderRadius: 6, maxHeight: 120, objectFit: "cover" }} />
              </>
            )}
            {typeof outputs["outputUrl"] === "string" && !outputs["outputUrl"].startsWith("data:") && (
              <a href={outputs["outputUrl"]} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: "var(--purple-400)" }}>
                View output ↗
              </a>
            )}
            {/* Token counts */}
            {typeof outputs["inputTokens"] === "number" && (
              <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 4 }}>
                {String(outputs["inputTokens"])}↑ / {String(outputs["outputTokens"])}↓ tokens
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {nodeRun.error && (
          <div style={{ marginTop: 8, fontSize: 10, color: "var(--status-failed)", background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, padding: "6px 8px", lineHeight: 1.4 }}>
            ⚠ {nodeRun.error}
          </div>
        )}
      </div>
    </details>
  );
}
