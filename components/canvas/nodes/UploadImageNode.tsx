"use client";

import { memo, useCallback, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { useWorkflowStore } from "@/store/workflowStore";
import { encodeHandleId } from "@/types/nodes";
import type { UploadImageNodeType } from "@/types/nodes";

export const UploadImageNode = memo(function UploadImageNode({ id, data, selected }: NodeProps<UploadImageNodeType>) {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const [uploading, setUploading] = useState(false);
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const outputHandle = encodeHandleId({ portDataType: "image", portIndex: 0 });

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file (JPG, PNG, WebP, GIF)");
      return;
    }
    setUploading(true);
    setUploadFileName(file.name);
    try {
      // Get Transloadit signature
      const signRes = await fetch("/api/transloadit/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetType: "image" }),
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
        uploads?: Array<{ ssl_url: string; name: string; size: number }>;
        assembly_id?: string;
      };

      const upload = result.uploads?.[0];
      if (upload) {
        updateNodeData<UploadImageNodeType>(id, {
          uploadedUrl: upload.ssl_url,
          uploadedFileName: upload.name,
          uploadedFileSizeBytes: upload.size,
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
        id={id} label={data.label} icon="🖼"
        accentColor="var(--node-image)"
        status={data.status} errorMessage={data.errorMessage}
        selected={selected} minWidth={240}
      >
        {data.uploadedUrl ? (
          <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: "1px solid var(--node-image-dim, rgba(16,185,129,0.2))" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={data.uploadedUrl}
              alt={data.uploadedFileName ?? "Uploaded image"}
              style={{ width: "100%", height: 150, objectFit: "cover", display: "block" }}
            />
            
            {/* Action overlay */}
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
              background: "linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 40%, transparent 60%, rgba(0,0,0,0.6) 100%)",
              pointerEvents: "none"
            }} />

            <button
              id={`node-${id}-clear`}
              onClick={() => updateNodeData<UploadImageNodeType>(id, { uploadedUrl: undefined, uploadedFileName: undefined })}
              style={{
                position: "absolute", top: 8, right: 8, width: 26, height: 26,
                borderRadius: "50%", background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)",
                border: "1px solid rgba(255,255,255,0.2)",
                color: "#fff", fontSize: 14, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                pointerEvents: "auto", transition: "all 0.2s"
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.8)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.4)"; }}
            >✕</button>

            {/* Metadata Bar */}
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              padding: "6px 10px", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontSize: 10, color: "#fff", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "70%" }}>
                {data.uploadedFileName || "Uploaded image"}
              </span>
              {data.uploadedFileSizeBytes && (
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.7)" }}>
                  {(data.uploadedFileSizeBytes / 1024).toFixed(0)} KB
                </span>
              )}
            </div>
          </div>
        ) : (
          /* Drop zone */
          <label
            htmlFor={`node-${id}-file`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", gap: 6,
              height: 110, borderRadius: 9, cursor: "pointer",
              border: `2px dashed ${dragOver ? "var(--node-image)" : "var(--border-default)"}`,
              background: dragOver ? "rgba(16,185,129,0.06)" : "var(--bg-elevated)",
              transition: "all 0.2s",
            }}
          >
            {uploading ? (
              <><div style={{ fontSize: 22 }}>⏳</div><span style={{ fontSize: 11, color: "var(--text-muted)" }}>Uploading &apos;{uploadFileName}&apos;…</span></>
            ) : (
              <><div style={{ fontSize: 24 }}>🖼</div><span style={{ fontSize: 11, color: "var(--text-muted)" }}>Drop image or click to upload</span><span style={{ fontSize: 10, color: "var(--text-disabled)" }}>JPG, PNG, WebP, GIF</span></>
            )}
          </label>
        )}
        <input id={`node-${id}-file`} type="file" accept="image/*" style={{ display: "none" }} onChange={onInputChange} />
      </BaseNode>
      <Handle type="source" position={Position.Right} id={outputHandle} data-handletype="image"
        style={{ right: -5, background: "var(--node-image)", border: "2px solid var(--bg-surface)" }} />
    </div>
  );
});
