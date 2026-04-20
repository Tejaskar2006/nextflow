import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes safely */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Format a duration in ms to a human-readable string */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60_000);
  const secs = Math.floor((ms % 60_000) / 1000);
  return `${mins}m ${secs}s`;
}

/** Format a Date or ISO string to a relative time */
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = Date.now();
  const diff = now - d.getTime();

  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString();
}

/** Generate a short cuid-like ID for client-side node creation */
export function generateNodeId(): string {
  return `node_${Math.random().toString(36).slice(2, 11)}`;
}

/** Generate a short cuid-like ID for edge creation */
export function generateEdgeId(): string {
  return `edge_${Math.random().toString(36).slice(2, 11)}`;
}

/** Clamp a number within a range */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
