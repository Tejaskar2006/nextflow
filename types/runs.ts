// ============================================================
// WORKFLOW RUN TYPES
// Used by API responses + the run history panel.
// ============================================================

export type WorkflowRunStatus =
  | "PENDING"
  | "RUNNING"
  | "SUCCESS"
  | "FAILED"
  | "PARTIAL";

export type ExecutionScope = "FULL" | "SINGLE" | "SELECTED";

export type NodeRunStatus =
  | "PENDING"
  | "RUNNING"
  | "SUCCESS"
  | "FAILED"
  | "SKIPPED";

export type DatabaseNodeType =
  | "TEXT"
  | "UPLOAD_IMAGE"
  | "UPLOAD_VIDEO"
  | "LLM"
  | "CROP_IMAGE"
  | "EXTRACT_FRAME";

export interface NodeRunRecord {
  id: string;
  workflowRunId: string;
  nodeId: string;
  nodeType: DatabaseNodeType;
  nodeLabel: string | null;
  status: NodeRunStatus;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  triggerTaskId: string | null;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  error: string | null;
  errorStack: string | null;
}

export interface WorkflowRunRecord {
  id: string;
  workflowId: string;
  userId: string;
  status: WorkflowRunStatus;
  scope: ExecutionScope;
  scopedNodeIds: string[];
  triggerRunId: string | null;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  error: string | null;
  nodeRuns: NodeRunRecord[];
}

// ────────────────────────────────────────────────────────────
// API RESPONSE SHAPES
// ────────────────────────────────────────────────────────────

export interface ExecuteWorkflowPayload {
  workflowId: string;
  scope: ExecutionScope;
  selectedNodeIds?: string[];
}

export interface ExecuteWorkflowResponse {
  workflowRunId: string;
  triggerRunId: string;
  status: WorkflowRunStatus;
}

export interface WorkflowRunListResponse {
  runs: WorkflowRunRecord[];
  total: number;
}

// ────────────────────────────────────────────────────────────
// TRIGGER TASK PAYLOADS
// ────────────────────────────────────────────────────────────

export interface LLMTaskPayload {
  workflowRunId: string;
  nodeRunId: string;
  model: string;
  systemPrompt: string;
  userMessage: string;
  imageUrls: string[];
}

export interface LLMTaskOutput {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export interface CropImageTaskPayload {
  workflowRunId: string;
  nodeRunId: string;
  imageUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CropImageTaskOutput {
  outputUrl: string;
  widthPx: number;
  heightPx: number;
}

export interface ExtractFrameTaskPayload {
  workflowRunId: string;
  nodeRunId: string;
  videoUrl: string;
  timeOffsetSeconds: number;
  outputFormat: "jpg" | "png" | "webp";
}

export interface ExtractFrameTaskOutput {
  outputUrl: string;
  widthPx: number;
  heightPx: number;
  timestampSeconds: number;
}

export interface WorkflowExecutionTaskPayload {
  workflowRunId: string;
  workflowId: string;
  userId: string;
  scope: ExecutionScope;
  selectedNodeIds: string[];
  /** Live node/edge snapshot from the browser. When provided, used instead of the DB copy.
   *  This eliminates the save-timing race: uploadedUrl is always present. */
  nodeSnapshot?: {
    nodes: unknown[];
    edges: unknown[];
  };
}
