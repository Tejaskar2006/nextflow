// ============================================================
// NODE DATA TYPES
// Every custom node in React Flow must use these typed payloads.
// ============================================================

import type { Node, Edge } from "@xyflow/react";

// The three wire / port types
export type PortDataType = "text" | "image" | "video";

export type NodeExecutionStatus =
  | "idle"
  | "pending"
  | "running"
  | "success"
  | "failed"
  | "skipped";

// ────────────────────────────────────────────────────────────
// TEXT NODE
// ────────────────────────────────────────────────────────────
export interface TextNodeData extends Record<string, unknown> {
  label: string;
  text: string;
  // set by the execution engine when this node's output is produced
  outputText?: string;
  status: NodeExecutionStatus;
  errorMessage?: string;
}

export type TextNodeType = Node<TextNodeData, "text">;

// ────────────────────────────────────────────────────────────
// UPLOAD IMAGE NODE
// ────────────────────────────────────────────────────────────
export interface UploadImageNodeData extends Record<string, unknown> {
  label: string;
  // URL returned from Transloadit after upload completes
  uploadedUrl?: string;
  uploadedFileName?: string;
  uploadedFileSizeBytes?: number;
  // transloadit assembly id for tracking
  assemblyId?: string;
  status: NodeExecutionStatus;
  errorMessage?: string;
}

export type UploadImageNodeType = Node<UploadImageNodeData, "upload_image">;

// ────────────────────────────────────────────────────────────
// UPLOAD VIDEO NODE
// ────────────────────────────────────────────────────────────
export interface UploadVideoNodeData extends Record<string, unknown> {
  label: string;
  uploadedUrl?: string;
  uploadedFileName?: string;
  uploadedFileSizeBytes?: number;
  durationSeconds?: number;
  assemblyId?: string;
  status: NodeExecutionStatus;
  errorMessage?: string;
}

export type UploadVideoNodeType = Node<UploadVideoNodeData, "upload_video">;

// ────────────────────────────────────────────────────────────
// LLM NODE (Gemini)
// ────────────────────────────────────────────────────────────
export interface LLMNodeData extends Record<string, unknown> {
  label: string;
  model: GeminiModel;
  systemPrompt: string;
  // Manual user message (disabled if input edge is connected)
  userMessage: string;
  systemPromptConnected?: boolean;
  // Whether a text input edge is connected
  userMessageConnected: boolean;
  // Whether one or more image edges are connected
  imageInputsConnected: boolean;
  // The runtime output text
  outputText?: string;
  // Token usage
  inputTokens?: number;
  outputTokens?: number;
  status: NodeExecutionStatus;
  errorMessage?: string;
  triggerRunId?: string;
}

export type LLMNodeType = Node<LLMNodeData, "llm">;

export type GeminiModel =
  | "gemini-2.0-flash"
  | "gemini-2.5-flash"
  | "gemini-2.5-pro"
  | "gemini-flash-latest";

// ────────────────────────────────────────────────────────────
// CROP IMAGE NODE (FFmpeg via Trigger.dev)
// ────────────────────────────────────────────────────────────
export interface CropImageNodeData extends Record<string, unknown> {
  label: string;
  // Crop parameters
  x: number;
  y: number;
  width: number;
  height: number;
  // Whether input image edge is connected
  imageInputConnected: boolean;
  // Output image URL (from Trigger.dev / temp storage)
  outputUrl?: string;
  status: NodeExecutionStatus;
  errorMessage?: string;
  triggerRunId?: string;
}

export type CropImageNodeType = Node<CropImageNodeData, "crop_image">;

// ────────────────────────────────────────────────────────────
// EXTRACT FRAME NODE (FFmpeg via Trigger.dev)
// ────────────────────────────────────────────────────────────
export interface ExtractFrameNodeData extends Record<string, unknown> {
  label: string;
  // Time offset to extract frame at (seconds)
  timeOffsetSeconds: number;
  // Output image format
  outputFormat: "jpg" | "png" | "webp";
  // Whether video input is connected
  videoInputConnected: boolean;
  outputUrl?: string;
  status: NodeExecutionStatus;
  errorMessage?: string;
  triggerRunId?: string;
}

export type ExtractFrameNodeType = Node<ExtractFrameNodeData, "extract_frame">;

// ────────────────────────────────────────────────────────────
// UNION TYPES
// ────────────────────────────────────────────────────────────
export type WorkflowNode =
  | TextNodeType
  | UploadImageNodeType
  | UploadVideoNodeType
  | LLMNodeType
  | CropImageNodeType
  | ExtractFrameNodeType;

export type WorkflowNodeType =
  | "text"
  | "upload_image"
  | "upload_video"
  | "llm"
  | "crop_image"
  | "extract_frame";

export type WorkflowEdge = Edge;

// ────────────────────────────────────────────────────────────
// PORT TYPE MAP
// Used by connection validator: maps node type → port data types
// ────────────────────────────────────────────────────────────
export const NODE_PORT_TYPES: Record<
  WorkflowNodeType,
  { inputs: PortDataType[]; outputs: PortDataType[] }
> = {
  text: { inputs: [], outputs: ["text"] },
  upload_image: { inputs: [], outputs: ["image"] },
  upload_video: { inputs: [], outputs: ["video"] },
  llm: { inputs: ["text", "text", "image", "image", "image"], outputs: ["text"] },
  crop_image: { inputs: ["image"], outputs: ["image"] },
  extract_frame: { inputs: ["video"], outputs: ["image"] },
};

// ────────────────────────────────────────────────────────────
// HANDLE METADATA (embedded in edge sourceHandle / targetHandle)
// ────────────────────────────────────────────────────────────
export interface HandleMeta {
  portDataType: PortDataType;
  portIndex?: number; // for multiple inputs (LLM images)
}

// Encode into a handle ID string: "text__0", "image__1", etc.
export function encodeHandleId(meta: HandleMeta): string {
  return `${meta.portDataType}__${meta.portIndex ?? 0}`;
}

export function decodeHandleId(handleId: string): HandleMeta {
  const [portDataType, portIndexStr] = handleId.split("__");
  return {
    portDataType: portDataType as PortDataType,
    portIndex: parseInt(portIndexStr ?? "0", 10),
  };
}
