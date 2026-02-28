"use client";

import React, { useState, useCallback } from "react";
import { Upload, FileText, Trash2, ChevronDown, ChevronRight, Loader2 } from "lucide-react";

export type KeyPointItem = { pageNumber: number; points: string[] };

export type UploadedDoc = {
  id: string;
  name: string;
  file_type: "pdf" | "docx" | "pptx";
  extracted_text?: string;
  key_points: KeyPointItem[];
  created_at: string;
};

type UploadedMaterialsProps = {
  uploads: UploadedDoc[];
  onRefresh: () => void;
  onUploadsChange?: (uploads: UploadedDoc[]) => void;
};

const STORAGE_KEY = "studybuddy_uploads_local";

export function getLocalUploads(): UploadedDoc[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown[];
    return Array.isArray(arr) ? arr.filter((u): u is UploadedDoc => u && typeof u === "object" && "id" in u && "name" in u) : [];
  } catch {
    return [];
  }
}

/** Save to localStorage without extracted_text to avoid size limits. */
export function setLocalUploads(uploads: UploadedDoc[]) {
  try {
    const stripped = uploads
      .filter((u) => u.id.startsWith("local-"))
      .map((u) => ({ id: u.id, name: u.name, file_type: u.file_type, key_points: u.key_points, created_at: u.created_at }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stripped));
  } catch {}
}

export default function UploadedMaterials({
  uploads,
  onRefresh,
  onUploadsChange,
}: UploadedMaterialsProps) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file) return;
      const valid = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.presentationml.presentation"];
      if (!valid.includes(file.type) && !/\.(pdf|docx|pptx)$/i.test(file.name)) {
        setError("Only PDF, DOCX, and PPTX are allowed.");
        return;
      }
      setError(null);
      setUploading(true);
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/studybuddy/uploads", { method: "POST", body: form });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "Upload failed");
          return;
        }
        if (data.saved && data.upload) {
          onRefresh();
        } else if (data.upload && !data.saved) {
          const u: UploadedDoc = {
            id: data.upload.id,
            name: data.upload.name,
            file_type: data.upload.file_type,
            key_points: data.upload.key_points || [],
            created_at: data.upload.created_at || new Date().toISOString(),
          };
          const next = [...uploads, u];
          setLocalUploads(next);
          onUploadsChange?.(next);
        }
      } finally {
        setUploading(false);
      }
    },
    [uploads, onRefresh, onUploadsChange]
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDelete = async (id: string) => {
    if (id.startsWith("local-")) {
      const next = uploads.filter((u) => u.id !== id);
      setLocalUploads(next);
      onUploadsChange?.(next);
      return;
    }
    const res = await fetch(`/api/studybuddy/uploads/${id}`, { method: "DELETE" });
    if (res.ok) onRefresh();
  };

  const displayList = uploads;

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          dragging ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10" : "border-[var(--border)] bg-[var(--muted)]/30"
        }`}
      >
        <input
          type="file"
          accept=".pdf,.docx,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation"
          className="hidden"
          id="studybuddy-upload-input"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
        <label htmlFor="studybuddy-upload-input" className="cursor-pointer flex flex-col items-center gap-2">
          {uploading ? (
            <Loader2 className="w-8 h-8 text-[var(--color-primary)] animate-spin" />
          ) : (
            <Upload className="w-8 h-8 text-[var(--muted-foreground)]" />
          )}
          <span className="text-sm text-[var(--foreground)]">
            {uploading ? "Processing…" : "Drop PDF, Word, or PowerPoint here or click to upload"}
          </span>
        </label>
        {error && <p className="text-sm text-[var(--color-error)] mt-2">{error}</p>}
      </div>

      {displayList.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-[var(--foreground)]">Your materials</p>
          {displayList.map((u) => (
            <div
              key={u.id}
              className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden"
            >
              <div
                className="flex items-center justify-between gap-2 p-3 cursor-pointer"
                onClick={() => setExpandedId(expandedId === u.id ? null : u.id)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {expandedId === u.id ? (
                    <ChevronDown className="w-4 h-4 shrink-0 text-[var(--muted-foreground)]" />
                  ) : (
                    <ChevronRight className="w-4 h-4 shrink-0 text-[var(--muted-foreground)]" />
                  )}
                  <FileText className="w-4 h-4 shrink-0 text-[var(--color-primary)]" />
                  <span className="text-sm font-medium text-[var(--foreground)] truncate">{u.name}</span>
                  <span className="text-xs text-[var(--muted-foreground)]">({u.file_type})</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleDelete(u.id); }}
                  className="p-1.5 rounded hover:bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--color-error)]"
                  title="Remove"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              {expandedId === u.id && Array.isArray(u.key_points) && u.key_points.length > 0 && (
                <div className="px-3 pb-3 pt-0 border-t border-[var(--border)]">
                  <p className="text-xs font-medium text-[var(--muted-foreground)] mt-2 mb-2">Key points by page</p>
                  <ul className="space-y-2 text-sm">
                    {u.key_points.map((kp) => (
                      <li key={kp.pageNumber}>
                        <span className="font-medium text-[var(--color-primary)]">Page {kp.pageNumber}:</span>
                        <ul className="list-disc list-inside ml-2 mt-0.5 text-[var(--foreground)]">
                          {(kp.points || []).map((p, i) => (
                            <li key={i}>{p}</li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
