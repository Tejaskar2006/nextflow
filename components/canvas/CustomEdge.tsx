"use client";

import { memo } from "react";
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import { decodeHandleId } from "@/types/nodes";

const TYPE_COLORS: Record<string, string> = {
  text:  "#3b82f6",
  image: "#10b981",
  video: "#f59e0b",
};

export const CustomEdge = memo(function CustomEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  sourceHandleId,
  selected, markerEnd,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  const portType = sourceHandleId
    ? decodeHandleId(sourceHandleId).portDataType
    : "text";

  const color = TYPE_COLORS[portType] ?? "#7c3aed";
  const strokeWidth = selected ? 2.5 : 1.8;

  return (
    <>
      {/* Glow layer */}
      <BaseEdge
        id={`${id}-glow`}
        path={edgePath}
        style={{
          stroke: color,
          strokeWidth: strokeWidth + 4,
          opacity: 0.15,
          filter: `blur(4px)`,
          pointerEvents: "none",
        }}
      />
      {/* Main edge */}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: color,
          strokeWidth,
          strokeDasharray: selected ? "6 3" : undefined,
          animation: selected ? "edgeFlow 0.5s linear infinite" : undefined,
        }}
      />
      {/* Animated dot traveling along selected edge */}
      {selected && (
        <circle r={3} fill={color} style={{ filter: `drop-shadow(0 0 4px ${color})` }}>
          <animateMotion
            dur="1.5s"
            repeatCount="indefinite"
            path={edgePath}
          />
        </circle>
      )}

      {/* Port type label */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "none",
            zIndex: 1,
          }}
        >
          {selected && (
            <span style={{
              fontSize: 9, fontWeight: 600, letterSpacing: "0.5px",
              color, background: "var(--bg-canvas)",
              padding: "1px 5px", borderRadius: 4,
              border: `1px solid ${color}40`,
              textTransform: "uppercase",
              opacity: 0.9,
            }}>
              {portType}
            </span>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
});
