"use client";

import { useEffect, useCallback, useState } from "react";
import { useWorkflowStore } from "@/store/workflowStore";
import { RunHistoryItem } from "./RunHistoryItem";
import { NodeRunBreakdown } from "./NodeRunBreakdown";
import { Spinner } from "@/components/ui/Spinner";
import type { WorkflowRunRecord } from "@/types/runs";

interface RightSidebarProps {
  workflowId: string;
}

export function RightSidebar({ workflowId }: RightSidebarProps) {
  const [isOpen, setIsOpen] = useState(true);
  const {
    runs, setRuns, isLoadingRuns, setIsLoadingRuns,
    selectedRunId, setSelectedRunId,
    isExecuting, activeRunId, deleteRun,
  } = useWorkflowStore();

  // ── Load run history
  const fetchRuns = useCallback(async () => {
    setIsLoadingRuns(true);
    try {
      const res = await fetch(`/api/workflows/${workflowId}/runs`);
      const data = (await res.json()) as { runs: WorkflowRunRecord[] };
      setRuns(data.runs ?? []);
    } finally {
      setIsLoadingRuns(false);
    }
  }, [workflowId, setRuns, setIsLoadingRuns]);

  useEffect(() => { void fetchRuns(); }, [fetchRuns]);

  const handleDeleteRun = useCallback(async (runId: string) => {
    if (!window.confirm("Are you sure you want to delete this run?")) return;
    try {
      deleteRun(runId);
      await fetch(`/api/runs/${runId}`, { method: "DELETE" });
    } catch (err) {
      console.error("Failed to delete run", err);
      void fetchRuns();
    }
  }, [deleteRun, fetchRuns]);

  const selectedRun = selectedRunId ? runs.find((r) => r.id === selectedRunId) : null;

  return (
    <aside style={{
      width: isOpen ? "var(--sidebar-right)" : "48px",
      minWidth: isOpen ? "var(--sidebar-right)" : "48px",
      background: "var(--bg-surface)",
      borderLeft: "1px solid var(--border-subtle)",
      display: "flex", flexDirection: "column",
      overflowY: "hidden", zIndex: 10,
      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    }}>
      {/* Toggle Button */}
      <div style={{ display: "flex", justifyContent: isOpen ? "flex-start" : "center", padding: "12px", borderBottom: "1px solid var(--border-subtle)" }}>
        <button onClick={() => setIsOpen(!isOpen)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "4px", borderRadius: "6px" }} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
          {isOpen ? "▶" : "◀"}
        </button>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto", opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? "auto" : "none", transition: "opacity 0.2s" }}>
        {/* Header */}
        <div style={{
          padding: "14px 16px 10px",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <h2 style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.8px", textTransform: "uppercase" }}>
              Run History
            </h2>
            {!isLoadingRuns && (
              <p style={{ fontSize: 10, color: "var(--text-disabled)", marginTop: 2 }}>
                {runs.length} run{runs.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {isExecuting && (
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <Spinner size={10} />
                <span style={{ fontSize: 10, color: "var(--status-running)" }}>Running…</span>
              </div>
            )}
            <button
              id="refresh-runs-btn"
              onClick={() => void fetchRuns()}
              style={{
                width: 26, height: 26, borderRadius: 6, border: "1px solid var(--border-subtle)",
                background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontSize: 13,
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s",
              }}
              title="Refresh"
            >↻</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
          {selectedRun ? (
            /* Node breakdown view */
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border-subtle)" }}>
                <button
                  id="back-to-runs-btn"
                  onClick={() => setSelectedRunId(null)}
                  style={{
                    display: "flex", alignItems: "center", gap: 5,
                    background: "none", border: "none", color: "var(--text-secondary)",
                    cursor: "pointer", fontSize: 12, padding: 0,
                  }}
                >
                  ← Back to runs
                </button>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px" }}>
                <NodeRunBreakdown run={selectedRun} />
              </div>
            </div>
          ) : isLoadingRuns ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Spinner size={20} />
            </div>
          ) : runs.length === 0 ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No runs yet.</p>
              <p style={{ fontSize: 11, color: "var(--text-disabled)", marginTop: 4 }}>Click Run to execute the workflow.</p>
            </div>
          ) : (
            <div style={{ padding: "8px" }}>
              {/* Active run at top */}
              {isExecuting && activeRunId && (
                <div style={{
                  padding: "10px 12px", borderRadius: 8, marginBottom: 6,
                  background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <Spinner size={10} />
                  <span style={{ fontSize: 11, color: "var(--status-running)", fontWeight: 600 }}>
                    Executing…
                  </span>
                </div>
              )}
              {runs.map((run) => (
                <RunHistoryItem
                  key={run.id}
                  run={run}
                  isSelected={run.id === selectedRunId}
                  onClick={() => setSelectedRunId(run.id)}
                  onDelete={() => void handleDeleteRun(run.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
