"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { confirmUpload, getUploadUrl } from "@/lib/actions/admin-media";
import type { MediaItem } from "@/lib/admin/media";
import { uploadProblem } from "@/lib/media/upload-rules";

/**
 * Browser → Neon Object Storage uploads (no bytes through the Next server):
 * getUploadUrl (server checks permission, type, size) → XHR PUT with progress →
 * confirmUpload (server re-reads the object with sharp, creates Media).
 * Each file is a task with progress, cancel and retry.
 */
export type UploadTask = {
  id: string;
  file: File;
  progress: number; // 0..1
  status: "uploading" | "confirming" | "done" | "error" | "canceled";
  error?: string;
};

/** Must equal the CacheControl signed into the presigned URL (lib/storage/core.ts IMMUTABLE). */
const CACHE_CONTROL = "public, max-age=31536000, immutable";

export function useUploader({ scope, maxMb, onUploaded }: { scope: "tmp" | "library"; maxMb: number; onUploaded: (m: MediaItem) => void }) {
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const xhrs = useRef(new Map<string, XMLHttpRequest>());
  const onUploadedRef = useRef(onUploaded);
  useEffect(() => {
    onUploadedRef.current = onUploaded;
  });

  const patch = useCallback((id: string, p: Partial<UploadTask>) => setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, ...p } : t))), []);

  const start = useCallback(
    async (task: UploadTask) => {
      const { id, file } = task;
      const problem = uploadProblem(file, maxMb);
      if (problem) return patch(id, { status: "error", error: problem });

      const signed = await getUploadUrl({ fileName: file.name, mime: file.type, size: file.size, scope });
      if (!signed.ok) return patch(id, { status: "error", error: signed.error });

      const put = await new Promise<"ok" | "canceled" | string>((resolve) => {
        const xhr = new XMLHttpRequest();
        xhrs.current.set(id, xhr);
        xhr.open("PUT", signed.data.url);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.setRequestHeader("Cache-Control", CACHE_CONTROL);
        xhr.upload.onprogress = (e) => e.lengthComputable && patch(id, { progress: e.loaded / e.total });
        xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300 ? "ok" : `Upload failed (${xhr.status}).`);
        xhr.onerror = () => resolve("Network error. Check your connection and retry.");
        xhr.onabort = () => resolve("canceled");
        xhr.send(file);
      });
      xhrs.current.delete(id);
      if (put === "canceled") return patch(id, { status: "canceled" });
      if (put !== "ok") return patch(id, { status: "error", error: put });

      patch(id, { status: "confirming", progress: 1 });
      const confirmed = await confirmUpload({ key: signed.data.key, fileName: file.name });
      if (!confirmed.ok) return patch(id, { status: "error", error: confirmed.error });
      patch(id, { status: "done" });
      onUploadedRef.current(confirmed.data);
      // Finished tiles give way to the real image.
      setTimeout(() => setTasks((ts) => ts.filter((t) => t.id !== id)), 400);
    },
    [maxMb, patch, scope],
  );

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const fresh = Array.from(files).map<UploadTask>((file) => ({ id: crypto.randomUUID(), file, progress: 0, status: "uploading" }));
      setTasks((ts) => [...ts, ...fresh]);
      for (const t of fresh) void start(t);
    },
    [start],
  );

  const cancel = useCallback((id: string) => xhrs.current.get(id)?.abort(), []);
  const dismiss = useCallback((id: string) => setTasks((ts) => ts.filter((t) => t.id !== id)), []);
  const retry = useCallback(
    (id: string) => {
      const task = tasks.find((t) => t.id === id);
      if (!task) return;
      const again = { ...task, progress: 0, status: "uploading" as const, error: undefined };
      patch(id, again);
      void start(again);
    },
    [patch, start, tasks],
  );

  return { tasks, addFiles, cancel, retry, dismiss, busy: tasks.some((t) => t.status === "uploading" || t.status === "confirming") };
}
