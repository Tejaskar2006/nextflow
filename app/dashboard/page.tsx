"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { formatRelativeTime } from "@/lib/utils";

interface WorkflowSummary {
  id: string;
  name: string;
  description: string | null;
  updatedAt: string;
  _count: { workflowRuns: number };
}

export default function DashboardPage() {
  const router = useRouter();
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const fetchWorkflows = useCallback(async () => {
    try {
      const res = await fetch("/api/workflows");
      const data = (await res.json()) as { workflows: WorkflowSummary[] };
      setWorkflows(data.workflows ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchWorkflows(); }, [fetchWorkflows]);

  const createWorkflow = useCallback(async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Untitled Workflow" }),
      });
      const data = (await res.json()) as { workflow: { id: string } };
      router.push(`/workflow/${data.workflow.id}`);
    } finally {
      setCreating(false);
    }
  }, [router]);

  const seedWorkflow = useCallback(async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/workflows/seed", { method: "POST" });
      const data = (await res.json()) as { workflow: { id: string } };
      if (data?.workflow?.id) {
        router.push(`/workflow/${data.workflow.id}`);
      } else {
        setCreating(false);
      }
    } catch (err) {
      console.error(err);
      setCreating(false);
    }
  }, [router]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-canvas)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <header style={{ height: 56, borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", background: "var(--bg-surface)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#7c3aed,#a970ff)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, boxShadow: "0 0 14px rgba(124,58,237,0.4)" }}>⚡</div>
          <span style={{ fontWeight: 700, fontSize: 16, background: "linear-gradient(135deg,#f0f0ff,#a970ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>NextFlow</span>
        </div>
        <UserButton appearance={{ elements: { avatarBox: { width: 30, height: 30 } } }} />
      </header>

      {/* Main */}
      <main style={{ flex: 1, maxWidth: 1100, width: "100%", margin: "0 auto", padding: "40px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>My Workflows</h1>
            <p style={{ color: "var(--text-muted)", fontSize: 13 }}>{workflows.length} workflow{workflows.length !== 1 ? "s" : ""}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={() => void seedWorkflow()}
              disabled={creating}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "var(--bg-elevated)", color: "var(--text-secondary)",
                border: "1px solid var(--border-default)", borderRadius: 10,
                padding: "10px 16px", fontSize: 13, fontWeight: 600,
                cursor: creating ? "not-allowed" : "pointer",
                opacity: creating ? 0.7 : 1, transition: "all 0.2s",
              }}
            >
              🌱 Seed Test Workflow
            </button>
          <button
            id="create-workflow-btn"
            onClick={() => void createWorkflow()}
            disabled={creating}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
              color: "#fff", border: "none", borderRadius: 10,
              padding: "10px 20px", fontSize: 14, fontWeight: 600,
              cursor: creating ? "not-allowed" : "pointer",
              opacity: creating ? 0.7 : 1,
              boxShadow: "0 0 24px rgba(124,58,237,0.35)",
              transition: "all 0.2s",
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
            {creating ? "Creating…" : "New Workflow"}
          </button>
          </div>
        </div>

        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ height: 140, borderRadius: 14, background: "linear-gradient(135deg, var(--bg-surface), var(--bg-elevated))", border: "1px solid var(--border-subtle)", animation: "pulse 1.5s ease-in-out infinite" }} />
            ))}
          </div>
        ) : workflows.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔮</div>
            <h2 style={{ color: "var(--text-primary)", fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No workflows yet</h2>
            <p style={{ color: "var(--text-muted)", marginBottom: 24 }}>Create your first LLM workflow to get started</p>
            <button
              onClick={() => void createWorkflow()}
              style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)", color: "#fff", border: "none", borderRadius: 10, padding: "12px 28px", fontSize: 14, fontWeight: 600, cursor: "pointer", boxShadow: "0 0 24px rgba(124,58,237,0.35)" }}
            >
              Create Workflow
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {workflows.map(wf => (
                <WorkflowCard
                  key={wf.id}
                  workflow={wf}
                  onOpen={() => router.push(`/workflow/${wf.id}`)}
                  onDelete={async () => {
                    if (confirm(`Are you sure you want to delete "${wf.name}"?`)) {
                      try {
                        const res = await fetch(`/api/workflows/${wf.id}`, { method: "DELETE" });
                        if (res.ok) {
                          setWorkflows(prev => prev.filter(w => w.id !== wf.id));
                        }
                      } catch (err) {
                        console.error("Failed to delete", err);
                      }
                    }
                  }}
                />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

interface WorkflowCardProps {
  workflow: WorkflowSummary;
  onOpen: () => void;
  onDelete: () => void;
}

function WorkflowCard({ workflow, onOpen, onDelete }: WorkflowCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      id={`workflow-card-${workflow.id}`}
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? "var(--bg-elevated)" : "var(--bg-surface)",
        border: `1px solid ${hovered ? "var(--border-purple)" : "var(--border-default)"}`,
        borderRadius: 14, padding: 20, cursor: "pointer",
        transition: "all 0.2s ease",
        boxShadow: hovered ? "0 8px 32px rgba(124,58,237,0.15)" : "0 2px 8px rgba(0,0,0,0.2)",
        transform: hovered ? "translateY(-2px)" : "none",
        position: "relative",
      }}
    >
      {/* Delete Button */}
      {hovered && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          style={{
            position: "absolute", top: 12, right: 12,
            width: 28, height: 28, borderRadius: 8,
            background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)",
            color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, cursor: "pointer", transition: "all 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)")}
        >
          ✕
        </button>
      )}

      {/* Icon */}
      <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg, rgba(124,58,237,0.3), rgba(169,112,255,0.2))", border: "1px solid var(--border-purple)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, marginBottom: 14 }}>
        ⚡
      </div>
      <h3 style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: 15, marginBottom: 6, lineHeight: 1.3 }}>{workflow.name}</h3>
      {workflow.description && (
        <p className="truncate-2" style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 14 }}>{workflow.description}</p>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {workflow._count.workflowRuns} run{workflow._count.workflowRuns !== 1 ? "s" : ""}
        </span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {formatRelativeTime(workflow.updatedAt)}
        </span>
      </div>
    </div>
  );
}
