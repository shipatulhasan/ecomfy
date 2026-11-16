"use client";

import { CirclePlusIcon, RotateCcwIcon, XIcon } from "lucide-react";
import { useRef, useState } from "react";
import { UPLOAD_ACCEPT } from "@/lib/media/upload-rules";
import { cn } from "@/lib/utils";
import type { UploadTask } from "./use-uploader";

/**
 * The dashed "Add Image" tile (Add Products.png / Product Media.png): click to
 * pick, or drop files on it. Multiple files.
 */
export function AddImageTile({ onFiles, disabled, className }: { onFiles: (files: FileList) => void; disabled?: boolean; className?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        if (disabled || !e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        if (disabled || e.dataTransfer.files.length === 0) return;
        e.preventDefault();
        setOver(false);
        onFiles(e.dataTransfer.files);
      }}
      className={cn(
        "relative rounded-xl border-2 border-dashed border-border transition-colors",
        over && "border-primary bg-secondary",
        disabled && "opacity-50",
        className,
      )}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => input.current?.click()}
        className="press flex size-full flex-col items-center justify-center gap-1 rounded-xl p-2 text-lead text-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
      >
        <CirclePlusIcon aria-hidden className="size-6 fill-primary stroke-primary-foreground" />
        Add Image
        <span className="sr-only">(JPG, PNG, WebP or AVIF; you can also drop files here)</span>
      </button>
      <input
        ref={input}
        type="file"
        accept={UPLOAD_ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/** An in-flight upload: progress bar, cancel, or the error with retry. */
export function UploadTaskTile({
  task,
  onCancel,
  onRetry,
  onDismiss,
  className,
}: {
  task: UploadTask;
  onCancel: () => void;
  onRetry: () => void;
  onDismiss: () => void;
  className?: string;
}) {
  const failed = task.status === "error" || task.status === "canceled";
  return (
    <div
      role="status"
      aria-label={`${task.file.name}: ${failed ? (task.error ?? "canceled") : `${Math.round(task.progress * 100)}%`}`}
      className={cn("relative flex flex-col justify-end gap-1.5 overflow-hidden rounded-xl border border-border bg-muted p-2", failed && "border-destructive/50", className)}
    >
      <p className="line-clamp-2 text-caption break-all text-foreground">{task.file.name}</p>
      {failed ? (
        <>
          <p className="line-clamp-3 text-caption text-destructive">{task.error ?? "Canceled"}</p>
          <div className="flex gap-1">
            <button type="button" onClick={onRetry} className="tap-target inline-flex items-center gap-1 rounded-md bg-card px-2 py-1 text-caption text-foreground hover:bg-secondary">
              <RotateCcwIcon aria-hidden className="size-3.5" /> Retry
            </button>
            <button type="button" onClick={onDismiss} aria-label={`Dismiss ${task.file.name}`} className="tap-target grid size-7 place-items-center rounded-md hover:bg-card">
              <XIcon aria-hidden className="size-3.5" />
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${Math.max(4, task.progress * 100)}%` }} />
          </div>
          <span className="text-caption text-muted-foreground">{task.status === "confirming" ? "Processing…" : `${Math.round(task.progress * 100)}%`}</span>
          {task.status === "uploading" && (
            <button
              type="button"
              onClick={onCancel}
              aria-label={`Cancel ${task.file.name}`}
              className="tap-target absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full bg-card text-foreground shadow-sm hover:bg-secondary"
            >
              <XIcon aria-hidden className="size-3.5" />
            </button>
          )}
        </>
      )}
    </div>
  );
}
