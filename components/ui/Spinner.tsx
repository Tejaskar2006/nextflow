"use client";

interface SpinnerProps {
  size?: number;
  color?: string;
}

export function Spinner({ size = 16, color = "var(--purple-400)" }: SpinnerProps) {
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 16 16"
      fill="none"
      style={{ animation: "spin 0.8s linear infinite", flexShrink: 0 }}
    >
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <circle cx="8" cy="8" r="6" stroke={color} strokeWidth="2" opacity="0.2" />
      <path d="M8 2a6 6 0 0 1 6 6" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
