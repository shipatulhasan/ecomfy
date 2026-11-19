"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/actions/result";
import { uploadProblem } from "@/lib/media/upload-rules";

/** Must equal the CacheControl signed into the presigned URL (lib/storage/core.ts IMMUTABLE). */
const CACHE_CONTROL = "public, max-age=31536000, immutable";

/**
 * One image straight to Neon (presigned PUT), then `finalize(key)` on the server
 * (re-read with sharp, resized, stored, saved). Same flow as Product Media,
 * without a library row.
 */
export function useImageUpload<R>({
  maxMb,
  presign,
  finalize,
  onDone,
}: {
  maxMb: number;
  presign: (input: { mime: string; size: number }) => Promise<ActionResult<{ key: string; url: string }>>;
  finalize: (key: string | null) => Promise<ActionResult<R>>;
  onDone: (result: R) => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<string | null>) =>
    start(async () => {
      setError(await fn());
    });

  const upload = (file: File) =>
    run(async () => {
      const problem = uploadProblem(file, maxMb);
      if (problem) return problem;
      const signed = await presign({ mime: file.type, size: file.size });
      if (!signed.ok) return signed.error;
      const put = await fetch(signed.data.url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type, "Cache-Control": CACHE_CONTROL },
      }).catch(() => null);
      if (!put?.ok) return "Upload failed. Check your connection and retry.";
      const res = await finalize(signed.data.key);
      if (!res.ok) return res.error;
      onDone(res.data);
      return null;
    });

  const remove = () =>
    run(async () => {
      const res = await finalize(null);
      if (!res.ok) return res.error;
      onDone(res.data);
      return null;
    });

  return { upload, remove, pending, error };
}
