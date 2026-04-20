// ============================================================
// DAG EXECUTION ENGINE
// ============================================================

import { detectCycle } from "./validator";
import type { WorkflowNode, WorkflowEdge } from "@/types/nodes";

export interface ExecutionLevel {
  level: number;
  nodeIds: string[];
}

export interface ResolvedExecutionPlan {
  levels: ExecutionLevel[];
  executionNodes: string[];
  nodeInputMap: Map<string, string[]>;
}

// ────────────────────────────────────────────────────────────
// COMPUTE EXECUTION LEVELS (Kahn's BFS, ES2015-safe)
// ────────────────────────────────────────────────────────────
export function computeExecutionPlan(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  selectedNodeIds?: string[]
): ResolvedExecutionPlan {
  const runNodeIds: string[] =
    selectedNodeIds && selectedNodeIds.length > 0
      ? selectedNodeIds
      : nodes.map((n) => n.id);

  const runNodeSet = new Set(runNodeIds);
  const relevantEdges = edges.filter(
    (e) => runNodeSet.has(e.source) && runNodeSet.has(e.target)
  );

  const cycleResult = detectCycle(runNodeIds, relevantEdges);
  if (cycleResult.hasCycle) {
    throw new Error(
      `Cannot execute: circular dependency detected among nodes [${(cycleResult.cyclePath ?? []).join(", ")}]`
    );
  }

  // Use plain objects instead of Map to avoid downlevelIteration issues
  const inDegreeObj: Record<string, number> = {};
  const adjacencyObj: Record<string, string[]> = {};
  const reverseAdjObj: Record<string, string[]> = {};

  for (const id of runNodeIds) {
    inDegreeObj[id] = 0;
    adjacencyObj[id] = [];
    reverseAdjObj[id] = [];
  }

  for (const edge of relevantEdges) {
    const src = edge.source;
    const tgt = edge.target;
    if (!(src in inDegreeObj) || !(tgt in inDegreeObj)) continue;
    adjacencyObj[src]!.push(tgt);
    reverseAdjObj[tgt]!.push(src);
    inDegreeObj[tgt] = (inDegreeObj[tgt] ?? 0) + 1;
  }

  // BFS by level
  const levels: ExecutionLevel[] = [];
  let currentLevel: string[] = runNodeIds.filter((id) => inDegreeObj[id] === 0);
  const visited = new Set<string>();

  while (currentLevel.length > 0) {
    levels.push({ level: levels.length, nodeIds: [...currentLevel] });
    const nextLevel: string[] = [];

    for (const nodeId of currentLevel) {
      visited.add(nodeId);
      for (const neighbor of adjacencyObj[nodeId] ?? []) {
        inDegreeObj[neighbor] = (inDegreeObj[neighbor] ?? 1) - 1;
        if (inDegreeObj[neighbor] === 0 && !visited.has(neighbor)) {
          nextLevel.push(neighbor);
        }
      }
    }

    currentLevel = nextLevel;
  }

  // Build nodeInputMap
  const nodeInputMap = new Map<string, string[]>();
  for (const target of Object.keys(reverseAdjObj)) {
    nodeInputMap.set(target, reverseAdjObj[target] ?? []);
  }

  const executionNodes = levels.flatMap((l) => l.nodeIds);
  return { levels, executionNodes, nodeInputMap };
}

// ────────────────────────────────────────────────────────────
// RESOLVE NODE INPUTS
// ────────────────────────────────────────────────────────────
export function resolveNodeInputs(
  nodeId: string,
  edges: WorkflowEdge[],
  outputStore: Map<string, unknown>
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  const incomingEdges = edges.filter((e) => e.target === nodeId);

  for (const edge of incomingEdges) {
    const outputKey = `${edge.source}::output`;
    const value = outputStore.get(outputKey);
    if (value !== undefined) {
      const inputKey = edge.targetHandle ?? edge.source;
      resolved[inputKey] = value;
    }
  }
  return resolved;
}

// ────────────────────────────────────────────────────────────
// EXECUTION RESULT STORE
// ────────────────────────────────────────────────────────────
export class ExecutionResultStore {
  private store = new Map<string, unknown>();
  private failedNodes = new Set<string>();

  setOutput(nodeId: string, output: unknown): void {
    this.store.set(`${nodeId}::output`, output);
  }

  getOutput(nodeId: string): unknown {
    return this.store.get(`${nodeId}::output`);
  }

  markFailed(nodeId: string): void {
    this.failedNodes.add(nodeId);
  }

  isFailed(nodeId: string): boolean {
    return this.failedNodes.has(nodeId);
  }

  hasUpstreamFailure(nodeId: string, edges: WorkflowEdge[]): boolean {
    const sources = edges.filter((e) => e.target === nodeId).map((e) => e.source);
    return sources.some((src) => this.failedNodes.has(src));
  }

  getResolvedInputs(nodeId: string, edges: WorkflowEdge[]): Record<string, unknown> {
    return resolveNodeInputs(nodeId, edges, this.store);
  }

  getAllOutputs(): Record<string, unknown> {
    return Object.fromEntries(this.store);
  }
}
