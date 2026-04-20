// ============================================================
// ZUSTAND WORKFLOW STORE
// Single source of truth for canvas state, execution, undo/redo
// ============================================================
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { applyNodeChanges, applyEdgeChanges } from "@xyflow/react";
import type {
  NodeChange,
  EdgeChange,
  Connection,
  Viewport,
} from "@xyflow/react";
import type {
  WorkflowNode,
  WorkflowEdge,
  NodeExecutionStatus,
} from "@/types/nodes";
import type { WorkflowRunRecord } from "@/types/runs";
import { generateNodeId, generateEdgeId } from "@/lib/utils";
import { encodeHandleId } from "@/types/nodes";

// ────────────────────────────────────────────────────────────
// SNAPSHOT for undo/redo
// ────────────────────────────────────────────────────────────
interface Snapshot {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

// ────────────────────────────────────────────────────────────
// EXECUTION STATE per node
// ────────────────────────────────────────────────────────────
export interface NodeExecutionState {
  status: NodeExecutionStatus;
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
  error?: string;
  outputs?: any;
}

// ────────────────────────────────────────────────────────────
// STORE INTERFACE
// ────────────────────────────────────────────────────────────
export interface WorkflowStore {
  // ── Canvas state
  workflowId: string | null;
  workflowName: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  viewport: Viewport;

  // ── Selection
  selectedNodeIds: string[];

  // ── Execution
  isExecuting: boolean;
  activeRunId: string | null;
  executionState: Record<string, NodeExecutionState>;

  // ── Run History
  runs: WorkflowRunRecord[];
  selectedRunId: string | null;
  isLoadingRuns: boolean;

  // ── Undo/Redo
  past: Snapshot[];
  future: Snapshot[];
  canUndo: boolean;
  canRedo: boolean;

  // ── Dirty tracking (for auto-save)
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: Date | null;

  // ── Actions: Canvas
  setWorkflow: (id: string, name: string, nodes: WorkflowNode[], edges: WorkflowEdge[], viewport: Viewport) => void;
  setWorkflowName: (name: string) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (type: WorkflowNode["type"], position: { x: number; y: number }) => void;
  removeNode: (nodeId: string) => void;
  updateNodeData: <T extends WorkflowNode>(nodeId: string, data: Partial<T["data"]>) => void;
  setViewport: (viewport: Viewport) => void;

  // ── Actions: Selection
  setSelectedNodeIds: (ids: string[]) => void;
  clearSelection: () => void;

  // ── Actions: Execution
  setIsExecuting: (v: boolean) => void;
  setActiveRunId: (id: string | null) => void;
  setNodeExecutionState: (nodeId: string, state: NodeExecutionState) => void;
  clearExecutionState: () => void;

  // ── Actions: Runs
  setRuns: (runs: WorkflowRunRecord[]) => void;
  prependRun: (run: WorkflowRunRecord) => void;
  deleteRun: (runId: string) => void;
  setSelectedRunId: (id: string | null) => void;
  setIsLoadingRuns: (v: boolean) => void;

  // ── Actions: Undo/Redo
  undo: () => void;
  redo: () => void;
  pushSnapshot: () => void;

  // ── Actions: Save state
  setIsDirty: (v: boolean) => void;
  setIsSaving: (v: boolean) => void;
  setLastSavedAt: (date: Date) => void;
}

// ────────────────────────────────────────────────────────────
// DEFAULT NODE DATA factories
// ────────────────────────────────────────────────────────────
function makeDefaultNodeData(type: WorkflowNode["type"]): WorkflowNode["data"] {
  switch (type) {
    case "text":
      return { label: "Text", text: "", status: "idle" };
    case "upload_image":
      return { label: "Upload Image", status: "idle" };
    case "upload_video":
      return { label: "Upload Video", status: "idle" };
    case "llm":
      return {
        label: "LLM",
        model: "gemini-1.5-flash",
        systemPrompt: "",
        userMessage: "",
        userMessageConnected: false,
        imageInputsConnected: false,
        status: "idle",
      };
    case "crop_image":
      return {
        label: "Crop Image",
        x: 0,
        y: 0,
        width: 512,
        height: 512,
        imageInputConnected: false,
        status: "idle",
      };
    case "extract_frame":
      return {
        label: "Extract Frame",
        timeOffsetSeconds: 0,
        outputFormat: "jpg",
        videoInputConnected: false,
        status: "idle",
      };
    default:
      return { label: "Node", status: "idle" };
  }
}

const MAX_HISTORY = 50;

// ────────────────────────────────────────────────────────────
// STORE
// ────────────────────────────────────────────────────────────
export const useWorkflowStore = create<WorkflowStore>()(
  immer((set) => ({
    // ── Initial state
    workflowId: null,
    workflowName: "Untitled Workflow",
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    selectedNodeIds: [],
    isExecuting: false,
    activeRunId: null,
    executionState: {},
    runs: [],
    selectedRunId: null,
    isLoadingRuns: false,
    past: [],
    future: [],
    canUndo: false,
    canRedo: false,
    isDirty: false,
    isSaving: false,
    lastSavedAt: null,

    // ── Canvas actions
    setWorkflow: (id, name, nodes, edges, viewport) => {
      set((state) => {
        state.workflowId = id;
        state.workflowName = name;
        state.nodes = nodes;
        state.edges = edges;
        state.viewport = viewport;
        state.past = [];
        state.future = [];
        state.canUndo = false;
        state.canRedo = false;
        state.isDirty = false;
        state.executionState = {};
      });
    },

    setWorkflowName: (name) => {
      set((state) => {
        state.workflowName = name;
        state.isDirty = true;
      });
    },

    onNodesChange: (changes) => {
      set((state) => {
        const hasPositionChange = changes.some((c) => c.type === "position");
        if (!hasPositionChange) {
          // Push snapshot before structural changes
          const hasDimensionOrRemove = changes.some(
            (c) => c.type === "remove" || c.type === "dimensions"
          );
          if (hasDimensionOrRemove && state.past.length < MAX_HISTORY) {
            state.past.push({ nodes: JSON.parse(JSON.stringify(state.nodes)), edges: JSON.parse(JSON.stringify(state.edges)) });
            state.future = [];
            state.canUndo = true;
            state.canRedo = false;
          }
        }
        state.nodes = applyNodeChanges(changes, state.nodes) as WorkflowNode[];
        state.isDirty = true;
      });
    },

    onEdgesChange: (changes) => {
      set((state) => {
        const hasRemove = changes.some((c) => c.type === "remove");
        if (hasRemove && state.past.length < MAX_HISTORY) {
          state.past.push({ nodes: JSON.parse(JSON.stringify(state.nodes)), edges: JSON.parse(JSON.stringify(state.edges)) });
          state.future = [];
          state.canUndo = true;
          state.canRedo = false;
        }
        state.edges = applyEdgeChanges(changes, state.edges) as WorkflowEdge[];
        state.isDirty = true;
      });
    },

    onConnect: (connection) => {
      set((state) => {
        state.past.push({ nodes: JSON.parse(JSON.stringify(state.nodes)), edges: JSON.parse(JSON.stringify(state.edges)) });
        state.future = [];
        state.canUndo = true;
        state.canRedo = false;

        const newEdge: WorkflowEdge = {
          id: generateEdgeId(),
          source: connection.source,
          target: connection.target,
          sourceHandle: connection.sourceHandle ?? undefined,
          targetHandle: connection.targetHandle ?? undefined,
          type: "custom",
          animated: false,
        };
        state.edges.push(newEdge);

        // Update connected flags on target nodes
        const targetNode = state.nodes.find((n) => n.id === connection.target);
        if (targetNode) {
          const th = connection.targetHandle ?? "";
          if (th.startsWith("text__")) {
            (targetNode.data as Record<string, unknown>)["userMessageConnected"] = true;
          }
          if (th.startsWith("image__")) {
            (targetNode.data as Record<string, unknown>)["imageInputsConnected"] = true;
            (targetNode.data as Record<string, unknown>)["imageInputConnected"] = true;
          }
          if (th.startsWith("video__")) {
            (targetNode.data as Record<string, unknown>)["videoInputConnected"] = true;
          }
        }

        state.isDirty = true;
      });
    },

    addNode: (type, position) => {
      set((state) => {
        state.past.push({ nodes: JSON.parse(JSON.stringify(state.nodes)), edges: JSON.parse(JSON.stringify(state.edges)) });
        state.future = [];
        state.canUndo = true;
        state.canRedo = false;

        const newNode = {
          id: generateNodeId(),
          type,
          position,
          data: makeDefaultNodeData(type),
        } as WorkflowNode;

        state.nodes.push(newNode);
        state.isDirty = true;
      });
    },

    removeNode: (nodeId) => {
      set((state) => {
        state.past.push({ nodes: JSON.parse(JSON.stringify(state.nodes)), edges: JSON.parse(JSON.stringify(state.edges)) });
        state.future = [];
        state.canUndo = true;
        state.canRedo = false;

        state.nodes = state.nodes.filter((n) => n.id !== nodeId);
        state.edges = state.edges.filter(
          (e) => e.source !== nodeId && e.target !== nodeId
        );
        state.isDirty = true;
      });
    },

    updateNodeData: (nodeId, data) => {
      set((state) => {
        const node = state.nodes.find((n) => n.id === nodeId);
        if (node) {
          Object.assign(node.data, data);
          state.isDirty = true;
        }
      });
    },

    setViewport: (viewport) => {
      set((state) => {
        state.viewport = viewport;
      });
    },

    // ── Selection
    setSelectedNodeIds: (ids) => {
      set((state) => { state.selectedNodeIds = ids; });
    },

    clearSelection: () => {
      set((state) => { state.selectedNodeIds = []; });
    },

    // ── Execution
    setIsExecuting: (v) => {
      set((state) => { state.isExecuting = v; });
    },

    setActiveRunId: (id) => {
      set((state) => { state.activeRunId = id; });
    },

    setNodeExecutionState: (nodeId, nodeState) => {
      set((state) => {
        state.executionState[nodeId] = nodeState;
        // Also update the node's data.status
        const node = state.nodes.find((n) => n.id === nodeId);
        if (node) {
          (node.data as Record<string, unknown>)["status"] = nodeState.status;
          if (nodeState.error) {
            (node.data as Record<string, unknown>)["errorMessage"] = nodeState.error;
          }
          if (nodeState.outputs) {
             const outputs = nodeState.outputs as any;
             if (node.type === "llm") {
                if (outputs.text !== undefined) (node.data as Record<string, unknown>)["outputText"] = outputs.text;
                if (outputs.inputTokens !== undefined) (node.data as Record<string, unknown>)["inputTokens"] = outputs.inputTokens;
                if (outputs.outputTokens !== undefined) (node.data as Record<string, unknown>)["outputTokens"] = outputs.outputTokens;
             } else if (node.type === "crop_image" || node.type === "extract_frame") {
                if (outputs.outputUrl !== undefined) (node.data as Record<string, unknown>)["outputUrl"] = outputs.outputUrl;
             }
          }
        }
      });
    },

    clearExecutionState: () => {
      set((state) => {
        state.executionState = {};
        state.nodes.forEach((n) => {
          (n.data as Record<string, unknown>)["status"] = "idle";
          delete (n.data as Record<string, unknown>)["errorMessage"];
        });
      });
    },

    // ── Runs
    setRuns: (runs) => { set((state) => { state.runs = runs; }); },
    prependRun: (run) => { set((state) => { state.runs.unshift(run); }); },
    deleteRun: (id) => {
      set((state) => {
        state.runs = state.runs.filter((r) => r.id !== id);
        if (state.selectedRunId === id) state.selectedRunId = null;
        if (state.activeRunId === id) {
          state.activeRunId = null;
          state.isExecuting = false;
        }
      });
    },
    setSelectedRunId: (id) => { set((state) => { state.selectedRunId = id; }); },
    setIsLoadingRuns: (v) => { set((state) => { state.isLoadingRuns = v; }); },

    // ── Undo/Redo
    pushSnapshot: () => {
      set((state) => {
        state.past.push({ nodes: JSON.parse(JSON.stringify(state.nodes)), edges: JSON.parse(JSON.stringify(state.edges)) });
        if (state.past.length > MAX_HISTORY) state.past.shift();
        state.future = [];
        state.canUndo = true;
        state.canRedo = false;
      });
    },

    undo: () => {
      set((state) => {
        const snapshot = state.past.pop();
        if (!snapshot) return;
        state.future.push({ nodes: JSON.parse(JSON.stringify(state.nodes)), edges: JSON.parse(JSON.stringify(state.edges)) });
        state.nodes = snapshot.nodes;
        state.edges = snapshot.edges;
        state.canUndo = state.past.length > 0;
        state.canRedo = true;
        state.isDirty = true;
      });
    },

    redo: () => {
      set((state) => {
        const snapshot = state.future.pop();
        if (!snapshot) return;
        state.past.push({ nodes: JSON.parse(JSON.stringify(state.nodes)), edges: JSON.parse(JSON.stringify(state.edges)) });
        state.nodes = snapshot.nodes;
        state.edges = snapshot.edges;
        state.canUndo = true;
        state.canRedo = state.future.length > 0;
        state.isDirty = true;
      });
    },

    // ── Save
    setIsDirty: (v) => { set((state) => { state.isDirty = v; }); },
    setIsSaving: (v) => { set((state) => { state.isSaving = v; }); },
    setLastSavedAt: (date) => { set((state) => { state.lastSavedAt = date; }); },
  }))
);

// ────────────────────────────────────────────────────────────
// Re-export encodeHandleId for convenience
// ────────────────────────────────────────────────────────────
export { encodeHandleId };
