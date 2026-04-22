"use client";

import dynamic from "next/dynamic";
import { useEffect, useCallback, useRef } from "react";
import { UserButton } from "@clerk/nextjs";
import { useWorkflowStore } from "@/store/workflowStore";
import { LeftSidebar } from "@/components/sidebar/LeftSidebar";
import { RightSidebar } from "@/components/sidebar/RightSidebar";
import { Spinner } from "@/components/ui/Spinner";
import type { WorkflowNode, WorkflowEdge } from "@/types/nodes";
import type { Viewport } from "@xyflow/react";

const FlowCanvas = dynamic(
  () => import("@/components/canvas/FlowCanvas").then((m) => m.FlowCanvas),
  { ssr: false, loading: () => <CanvasLoader /> }
);

interface WorkflowEditorClientProps {
  workflowId: string;
}

export function WorkflowEditorClient({ workflowId }: WorkflowEditorClientProps) {
  const {
    workflowName, setWorkflow, setWorkflowName,
    isDirty, isSaving, setIsSaving, setIsDirty, setLastSavedAt,
    nodes, edges, viewport,
    isExecuting,
    undo, redo, canUndo, canRedo,
  } = useWorkflowStore();

  // ── Load workflow on mount
  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/workflows/${workflowId}`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        workflow: {
          name: string;
          nodes: WorkflowNode[];
          edges: WorkflowEdge[];
          viewport: Viewport;
        };
      };
      const wf = data.workflow;
      setWorkflow(workflowId, wf.name, wf.nodes ?? [], wf.edges ?? [], wf.viewport ?? { x: 0, y: 0, zoom: 1 });
    })();
  }, [workflowId, setWorkflow]);

  // ── Auto-save (debounced)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isDirty || isSaving) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void (async () => {
        setIsSaving(true);
        try {
          await fetch(`/api/workflows/${workflowId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: workflowName, nodes, edges, viewport }),
          });
          setIsDirty(false);
          setLastSavedAt(new Date());
        } finally {
          setIsSaving(false);
        }
      })();
    }, 1500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [isDirty, isSaving, workflowId, workflowName, nodes, edges, viewport, setIsSaving, setIsDirty, setLastSavedAt]);

  // ── Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        if (canRedo) redo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canUndo, canRedo, undo, redo]);

  const handleExecute = useCallback(async (scope: "FULL" | "SELECTED", selectedIds?: string[]) => {
    const store = useWorkflowStore.getState();
    store.setIsExecuting(true);
    store.clearExecutionState();
    try {
      // ── Give the store a moment to "settle" (e.g. Cloudinary re-host finishing)
      await new Promise(r => setTimeout(r, 500));

      // ── Get the absolutely freshest state for the snapshot
      const currentState = useWorkflowStore.getState();
      
      // DEBUG: Log everything we are about to send
      const uploadNodes = currentState.nodes.filter(n => n.type === "upload_image" || n.type === "upload_video");
      console.log("[EXECUTE] Sending snapshot to server:", {
        nodeCount: currentState.nodes.length,
        uploadDetails: uploadNodes.map(n => ({
          type: n.type,
          url: (n.data as Record<string, any>).uploadedUrl || "(MISSING!)"
        }))
      });

      const patchRes = await fetch(`/api/workflows/${workflowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: currentState.workflowName,
          nodes: currentState.nodes,
          edges: currentState.edges,
          viewport: currentState.viewport,
        }),
      });
      console.log("[EXECUTE] Force-save PATCH status:", patchRes.status);
      
      store.setIsDirty(false);
      store.setLastSavedAt(new Date());

      const res = await fetch(`/api/workflows/${workflowId}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          selectedNodeIds: selectedIds ?? [],
          // Pass live node data directly — Trigger.dev task uses this instead of DB.
          // This guarantees uploadedUrl is always included, no save-timing race.
          nodeSnapshot: {
            nodes: currentState.nodes,
            edges: currentState.edges,
          },
        }),
      });

      const data = (await res.json()) as {
        workflowRunId?: string;
        triggerRunId?: string | null;
        status?: string;
        error?: string;
      };

      // Always store the run ID if we got one (even if FAILED)
      if (data.workflowRunId) {
        store.setActiveRunId(data.workflowRunId);
      }

      // If Trigger.dev failed or run was rejected, stop executing immediately
      if (!res.ok || data.status === "FAILED" || !data.workflowRunId) {
        console.error("Execute failed:", data.error ?? "Unknown error");
        store.setIsExecuting(false);
        // Refresh run list so the FAILED run appears in history
        if (data.workflowRunId) {
          const runsRes = await fetch(`/api/workflows/${workflowId}/runs`);
          const runsData = (await runsRes.json()) as { runs: [] };
          store.setRuns(runsData.runs ?? []);
        }
        return;
      }

      // Happy path — poll for completion
      void pollRunStatus(data.workflowRunId, store);
    } catch (err) {
      console.error("Execute error:", err);
      store.setIsExecuting(false);
    }
  }, [workflowId]);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "var(--bg-canvas)", overflow: "hidden" }}>
      {/* Topbar */}
      <header style={{
        height: 48, minHeight: 48,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 16px",
        background: "var(--bg-surface)",
        borderBottom: "1px solid var(--border-subtle)",
        zIndex: 50,
      }}>
        {/* Left: logo + name */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: "linear-gradient(135deg,#7c3aed,#a970ff)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, boxShadow: "0 0 12px rgba(124,58,237,0.4)" }}>⚡</div>
          <input
            id="workflow-name-input"
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            style={{
              background: "transparent", border: "none", outline: "none",
              color: "var(--text-primary)", fontSize: 14, fontWeight: 600,
              width: 220,
            }}
          />
        </div>

        {/* Center: undo/redo + status */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button id="undo-btn" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" style={iconBtnStyle(!canUndo)}>↩</button>
          <button id="redo-btn" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)" style={iconBtnStyle(!canRedo)}>↪</button>
          <div style={{ width: 1, height: 20, background: "var(--border-subtle)", margin: "0 4px" }} />
          <SaveStatus isSaving={isSaving} isDirty={isDirty} />
        </div>

        {/* Right: run + user */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            id="run-workflow-btn"
            onClick={() => void handleExecute("FULL")}
            disabled={isExecuting}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: isExecuting ? "var(--bg-elevated)" : "linear-gradient(135deg, #7c3aed, #6d28d9)",
              color: isExecuting ? "var(--text-muted)" : "#fff",
              border: "none", borderRadius: 8,
              padding: "6px 16px", fontSize: 13, fontWeight: 600,
              cursor: isExecuting ? "not-allowed" : "pointer",
              boxShadow: isExecuting ? "none" : "0 0 16px rgba(124,58,237,0.35)",
              transition: "all 0.2s",
            }}
          >
            {isExecuting ? <><Spinner size={12} />&nbsp;Running…</> : "▶ Run"}
          </button>
          <UserButton appearance={{ elements: { avatarBox: { width: 28, height: 28 } } }} />
        </div>
      </header>

      {/* Body */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <LeftSidebar onExecute={handleExecute} />
        <FlowCanvas workflowId={workflowId} onExecute={handleExecute} />
        <RightSidebar workflowId={workflowId} />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Poll run status until terminal state
// ────────────────────────────────────────────────────────────
async function pollRunStatus(runId: string, store: ReturnType<typeof useWorkflowStore.getState>) {
  const terminalStatuses = ["SUCCESS", "FAILED", "PARTIAL"];
  let attempts = 0;

  const poll = async (): Promise<void> => {
    if (attempts++ > 120) {
      store.setIsExecuting(false);
      return;
    }
    try {
      const res = await fetch(`/api/runs/${runId}`);
      const data = (await res.json()) as { run: { status: string; nodeRuns: Array<{ nodeId: string; status: string; error: string | null; outputs: any }> } };
      const run = data.run;

      // Update per-node execution state
      for (const nr of run.nodeRuns) {
        store.setNodeExecutionState(nr.nodeId, {
          status: nr.status.toLowerCase() as "running" | "success" | "failed" | "skipped" | "pending",
          error: nr.error ?? undefined,
          outputs: nr.outputs,
        });
      }

      if (terminalStatuses.includes(run.status)) {
        store.setIsExecuting(false);
        // Refresh run history
        const runsRes = await fetch(`/api/workflows/${store.workflowId}/runs`);
        const runsData = (await runsRes.json()) as { runs: [] };
        store.setRuns(runsData.runs ?? []);
      } else {
        setTimeout(() => void poll(), 2000);
      }
    } catch {
      store.setIsExecuting(false);
    }
  };

  await poll();
}

function CanvasLoader() {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-canvas)" }}>
      <Spinner size={32} />
    </div>
  );
}

function iconBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    width: 30, height: 30, borderRadius: 7, border: "1px solid var(--border-subtle)",
    background: "transparent", color: disabled ? "var(--text-disabled)" : "var(--text-secondary)",
    cursor: disabled ? "not-allowed" : "pointer", fontSize: 14,
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "all 0.15s",
  };
}

function SaveStatus({ isSaving, isDirty }: { isSaving: boolean; isDirty: boolean }) {
  if (isSaving) return <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Saving…</span>;
  if (isDirty) return <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Unsaved</span>;
  return <span style={{ fontSize: 11, color: "var(--status-success)", opacity: 0.7 }}>✓ Saved</span>;
}
