"use client";

import { memo, useCallback, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { useWorkflowStore } from "@/store/workflowStore";
import { encodeHandleId } from "@/types/nodes";
import type { UploadVideoNodeType } from "@/types/nodes";

export const UploadVideoNode = memo(function UploadVideoNode({ id, data, selected }: NodeProps<UploadVideoNodeType>) {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const [uploading, setUploading] = useState(false);
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const outputHandle = encodeHandleId({ portDataType: "video", portIndex: 0 });

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("video/")) {
      alert("Please select a video file (MP4, MOV, WebM, AVI)");
      return;
    }
    setUploading(true);
    setUploadFileName(file.name);
    try {
      const signRes = await fetch("/api/transloadit/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetType: "video" }),
      });
      const { params, signature } = (await signRes.json()) as { params: string; signature: string };

      const form = new FormData();
      form.append("params", params);
      form.append("signature", signature);
      form.append("file", file);

      const uploadRes = await fetch("https://api2.transloadit.com/assemblies", {
        method: "POST",
        body: form,
      });
      const result = (await uploadRes.json()) as {
        uploads?: Array<{ ssl_url: string; name: string; size: number; meta?: { duration?: number } }>;
        assembly_id?: string;
      };

      const upload = result.uploads?.[0];
      if (upload) {
        updateNodeData<UploadVideoNodeType>(id, {
          uploadedUrl: upload.ssl_url,
          uploadedFileName: upload.name,
          uploadedFileSizeBytes: upload.size,
          durationSeconds: upload.meta?.duration,
          assemblyId: result.assembly_id,
        });
      }
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      setUploading(false);
      setUploadFileName(null);
    }
  }, [id, updateNodeData]);

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) void handleFile(file);
    },
    [handleFile]
  );

  return (
    <div style={{ position: "relative" }}>
      <BaseNode
        id={id} label={data.label} icon="🎬"
        accentColor="var(--node-video)"
        status={data.status} errorMessage={data.errorMessage}
        selected={selected} minWidth={240}
      >
        {data.uploadedUrl ? (
          <div>
            <video
              src={data.uploadedUrl}
              controls
              style={{ width: "100%", height: 130, objectFit: "cover", borderRadius: 8, display: "block", background: "#000" }}
            />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                {data.uploadedFileName}
                {data.durationSeconds && ` · ${data.durationSeconds.toFixed(1)}s`}
              </span>
              <button
                id={`node-${id}-clear`}
                onClick={() => updateNodeData<UploadVideoNodeType>(id, { uploadedUrl: undefined })}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 12 }}
              >✕</button>
            </div>
          </div>
        ) : (
          <label
            htmlFor={`node-${id}-file`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", gap: 6,
              height: 110, borderRadius: 9, cursor: "pointer",
              border: `2px dashed ${dragOver ? "var(--node-video)" : "var(--border-default)"}`,
              background: dragOver ? "rgba(245,158,11,0.06)" : "var(--bg-elevated)",
              transition: "all 0.2s",
            }}
          >
            {uploading
              ? <><span style={{ fontSize: 22 }}>⏳</span><span style={{ fontSize: 11, color: "var(--text-muted)" }}>Uploading &apos;{uploadFileName}&apos;…</span></>
              : <><span style={{ fontSize: 24 }}>🎬</span><span style={{ fontSize: 11, color: "var(--text-muted)" }}>Drop video or click to upload</span><span style={{ fontSize: 10, color: "var(--text-disabled)" }}>MP4, MOV, WebM, AVI</span></>
            }
          </label>
        )}
        <input id={`node-${id}-file`} type="file" accept="video/*" style={{ display: "none" }} onChange={onInputChange} />
      </BaseNode>
      <Handle type="source" position={Position.Right} id={outputHandle} data-handletype="video"
        style={{ right: -5, background: "var(--node-video)", border: "2px solid var(--bg-surface)" }} />
    </div>
  );
});
