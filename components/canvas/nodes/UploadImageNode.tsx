"use client";

import { memo, useCallback, useState, useEffect } from "react";
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
  // Local blob URL for instant preview before upload completes
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);

  // Clean up blob URL on unmount
  useEffect(() => {
    return () => { if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const outputHandle = encodeHandleId({ portDataType: "image", portIndex: 0 });

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file (JPG, PNG, WebP, GIF)");
      return;
    }
    // ── Instant local preview
    const blobUrl = URL.createObjectURL(file);
    setLocalPreviewUrl(blobUrl);
    setUploading(true);
    setUploadFileName(file.name);
    try {
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
      const result = (await uploadRes.json()) as any;
      const key = process.env.NEXT_PUBLIC_TRANSLOADIT_KEY;
      const templateId = process.env.NEXT_PUBLIC_TRANSLOADIT_IMAGE_TEMPLATE_ID || process.env.TRANSLOADIT_IMAGE_TEMPLATE_ID;
      console.log("[UPLOAD] API Raw Result:", result);

      const upload = result?.uploads?.[0];
      if (upload) {
        console.log("[UPLOAD] Found upload:", upload.name, upload.ssl_url);
        // Re-host on Cloudinary so the URL is permanent and publicly accessible
        let finalUrl = upload.ssl_url;
        try {
          console.log("[UPLOAD] Re-hosting to Cloudinary...", upload.ssl_url);
          const rehostRes = await fetch("/api/upload/rehost", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: upload.ssl_url }),
          });
          if (rehostRes.ok) {
            const rehostData = (await rehostRes.json()) as { url: string };
            finalUrl = rehostData.url;
            console.log("[UPLOAD] Cloudinary URL acquired:", finalUrl);
          } else {
            const errText = await rehostRes.text();
            console.error("[UPLOAD] Cloudinary Re-host API error:", errText);
          }
        } catch (rehostErr) {
          console.error("[UPLOAD] Re-host failed, using original URL:", rehostErr);
        }

        updateNodeData<UploadImageNodeType>(id, {
          uploadedUrl: finalUrl,
          uploadedFileName: upload.name,
          uploadedFileSizeBytes: upload.size,
          assemblyId: result.assembly_id,
        });
        console.log("[UPLOAD] Zustand store updated with URL:", finalUrl);
        // Remote URL is now saved — revoke local blob immediately
        URL.revokeObjectURL(blobUrl);
        setLocalPreviewUrl(null);
      } else {
        console.warn("[UPLOAD] No uploads found in result:", result);
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
        {/* Show preview if we have a remote URL OR a local blob preview during upload */}
        {(data.uploadedUrl || localPreviewUrl) ? (
          <div>
            {/* Image preview */}
            <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: `1px solid ${uploading ? "rgba(16,185,129,0.15)" : "rgba(16,185,129,0.25)"}`, height: 110 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={data.uploadedUrl ?? localPreviewUrl ?? ""}
                alt={uploadFileName ?? data.uploadedFileName ?? "Uploaded image"}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", cursor: uploading ? "default" : "pointer" }}
                onClick={() => { if (!uploading) document.getElementById(`node-${id}-file`)?.click(); }}
              />
              {/* Top gradient for button legibility */}
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: 36,
                background: "linear-gradient(to bottom, rgba(0,0,0,0.35), transparent)",
                pointerEvents: "none"
              }} />

              {/* Uploading overlay */}
              {uploading && (
                <div style={{
                  position: "absolute", inset: 0,
                  background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6,
                  pointerEvents: "none",
                }}>
                  <div style={{ fontSize: 18 }}>⏳</div>
                  <span style={{ fontSize: 10, color: "#fff", fontWeight: 500 }}>Uploading…</span>
                </div>
              )}

              {!uploading && (
                <button
                  id={`node-${id}-clear`}
                  onClick={(e) => {
                    e.stopPropagation();
                    updateNodeData<UploadImageNodeType>(id, { uploadedUrl: undefined, uploadedFileName: undefined });
                  }}
                  style={{
                    position: "absolute", top: 6, right: 6, width: 22, height: 22,
                    borderRadius: "50%", background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    color: "#fff", fontSize: 11, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    pointerEvents: "auto", transition: "all 0.2s", zIndex: 10
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.8)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.4)"; }}
                >✕</button>
              )}
            </div>

            {/* File info strip */}
            <div style={{
              marginTop: 6,
              display: "flex", alignItems: "center", gap: 7,
              padding: "5px 8px",
              background: "rgba(16,185,129,0.07)",
              border: "1px solid rgba(16,185,129,0.18)",
              borderRadius: 7,
            }}>
              <span style={{ fontSize: 13, lineHeight: 1 }}>🖼️</span>
              <span style={{
                flex: 1, fontSize: 11, fontWeight: 500,
                color: "var(--text-primary)",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>
                {uploadFileName ?? data.uploadedFileName ?? "image"}
              </span>
              {uploading ? (
                <span style={{ fontSize: 9, color: "#f59e0b", fontWeight: 600, flexShrink: 0 }}>uploading…</span>
              ) : (
                <>
                  {data.uploadedFileSizeBytes && (
                    <span style={{
                      fontSize: 10, color: "var(--text-muted)",
                      background: "var(--bg-elevated)", padding: "1px 5px", borderRadius: 4, flexShrink: 0
                    }}>
                      {(data.uploadedFileSizeBytes / 1024).toFixed(0)} KB
                    </span>
                  )}
                  <span style={{ fontSize: 11, color: "#10b981", flexShrink: 0 }}>✓</span>
                </>
              )}
            </div>
          </div>
        ) : (
          /* Drop zone — only shown when nothing selected */
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
            <div style={{ fontSize: 24 }}>🖼</div>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Drop image or click to upload</span>
            <span style={{ fontSize: 10, color: "var(--text-disabled)" }}>JPG, PNG, WebP, GIF</span>
          </label>
        )}
        <input id={`node-${id}-file`} type="file" accept="image/*" style={{ display: "none" }} onChange={onInputChange} />
      </BaseNode>
      <Handle type="source" position={Position.Right} id={outputHandle} data-handletype="image"
        style={{ right: -5, background: "var(--node-image)", border: "2px solid var(--bg-surface)" }} />
    </div>
  );
});
