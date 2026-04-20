// ============================================================
// DAG VALIDATOR
// Provides:
//   1. Cycle detection (Kahn's algorithm)
//   2. Type-safe connection validation
// ============================================================

import type { WorkflowNode, WorkflowEdge, PortDataType } from "@/types/nodes";
import { decodeHandleId, NODE_PORT_TYPES } from "@/types/nodes";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// ────────────────────────────────────────────────────────────
// CYCLE DETECTION
// Uses Kahn's topological sort algorithm.
// Returns { hasCycle: boolean, order: string[] }
// ────────────────────────────────────────────────────────────
export interface TopologicalResult {
  hasCycle: boolean;
  order: string[];      // topological order of node IDs (if no cycle)
  cyclePath?: string[]; // partial path involved in cycle (if any)
}

export function detectCycle(
  nodeIds: string[],
  edges: WorkflowEdge[]
): TopologicalResult {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  // Initialize
  for (const id of nodeIds) {
    inDegree.set(id, 0);
    adjacency.set(id, []);
  }

  // Build graph
  for (const edge of edges) {
    const src = edge.source;
    const tgt = edge.target;

    // Only consider edges between known nodes
    if (!inDegree.has(src) || !inDegree.has(tgt)) continue;

    adjacency.get(src)!.push(tgt);
    inDegree.set(tgt, (inDegree.get(tgt) ?? 0) + 1);
  }

  // Kahn's BFS
  const queue: string[] = [];
  for (const id of nodeIds) {
    if ((inDegree.get(id) ?? 0) === 0) queue.push(id);
  }

  const order: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    order.push(node);

    for (const neighbor of adjacency.get(node) ?? []) {
      const newDeg = (inDegree.get(neighbor) ?? 0) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  if (order.length !== nodeIds.length) {
    // Find cycle participants
    const cyclePath = nodeIds.filter((id) => !order.includes(id));
    return { hasCycle: true, order, cyclePath };
  }

  return { hasCycle: false, order };
}

// ────────────────────────────────────────────────────────────
// CONNECTION TYPE VALIDATOR
// Called by React Flow's isValidConnection callback.
// ────────────────────────────────────────────────────────────
export interface ConnectionParams {
  source: string;
  target: string;
  sourceHandle: string | null;
  targetHandle: string | null;
  sourceNodeType: string;
  targetNodeType: string;
}

export interface ConnectionValidationResult {
  valid: boolean;
  reason?: string;
}

export function validateConnection(
  params: ConnectionParams,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): ConnectionValidationResult {
  const { source, target, sourceHandle, targetHandle } = params;

  // Prevent self-loops
  if (source === target) {
    return { valid: false, reason: "Cannot connect a node to itself" };
  }

  // Check type compatibility
  if (!sourceHandle || !targetHandle) {
    return { valid: false, reason: "Missing handle metadata" };
  }

  const sourceMeta = decodeHandleId(sourceHandle);
  const targetMeta = decodeHandleId(targetHandle);

  if (sourceMeta.portDataType !== targetMeta.portDataType) {
    return {
      valid: false,
      reason: `Type mismatch: ${sourceMeta.portDataType} → ${targetMeta.portDataType}`,
    };
  }

  // Check source node output type
  const sourceNode = nodes.find((n) => n.id === source);
  const targetNode = nodes.find((n) => n.id === target);

  if (!sourceNode || !targetNode) {
    return { valid: false, reason: "Node not found" };
  }

  const sourceNodePorts = NODE_PORT_TYPES[sourceNode.type as keyof typeof NODE_PORT_TYPES];
  const targetNodePorts = NODE_PORT_TYPES[targetNode.type as keyof typeof NODE_PORT_TYPES];

  if (!sourceNodePorts || !targetNodePorts) {
    return { valid: false, reason: "Unknown node type" };
  }

  const outputType: PortDataType = sourceMeta.portDataType;

  if (!sourceNodePorts.outputs.includes(outputType)) {
    return {
      valid: false,
      reason: `${sourceNode.type} does not output ${outputType}`,
    };
  }

  if (!targetNodePorts.inputs.includes(outputType)) {
    return {
      valid: false,
      reason: `${targetNode.type} does not accept ${outputType} input`,
    };
  }

  // Check for potential cycle BEFORE adding the edge
  const potentialEdges: WorkflowEdge[] = [
    ...edges,
    {
      id: "__preview__",
      source,
      target,
      sourceHandle,
      targetHandle,
    },
  ];

  const nodeIds = nodes.map((n) => n.id);
  const cycleResult = detectCycle(nodeIds, potentialEdges);

  if (cycleResult.hasCycle) {
    return {
      valid: false,
      reason: "This connection would create a circular dependency",
    };
  }

  return { valid: true };
}

// ────────────────────────────────────────────────────────────
// WORKFLOW VALIDATION (pre-execution)
// ────────────────────────────────────────────────────────────
export function validateWorkflowForExecution(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  selectedNodeIds?: string[]
): ValidationResult {
  const errors: string[] = [];

  if (nodes.length === 0) {
    return { valid: false, errors: ["Workflow has no nodes"] };
  }

  const nodeIds = nodes.map((n) => n.id);

  // Check for cycles
  const cycleResult = detectCycle(nodeIds, edges);
  if (cycleResult.hasCycle) {
    errors.push(
      `Circular dependency detected between nodes: ${(cycleResult.cyclePath ?? []).join(", ")}`
    );
  }

  // If running selected nodes, check they exist
  if (selectedNodeIds && selectedNodeIds.length > 0) {
    for (const id of selectedNodeIds) {
      if (!nodeIds.includes(id)) {
        errors.push(`Selected node ${id} does not exist in the workflow`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
