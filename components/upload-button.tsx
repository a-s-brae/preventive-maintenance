"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { MAX_BYTES } from "@/lib/files";

/** Longest side, in pixels, that photos are shrunk to before uploading. */
const MAX_SIDE = 1600;

/** Shrink big photos in the browser so a phone picture is ~300 KB, not 5 MB. */
async function shrinkImage(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 1.5 * 1024 * 1024) return file;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
}

export function UploadButton({ target }: { target: { workOrderId: string } | { assetId: string } }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(files: FileList) {
    setError(null);
    const list = [...files];
    for (const [i, original] of list.entries()) {
      setStatus(list.length > 1 ? `Uploading ${i + 1} of ${list.length}…` : "Uploading…");
      const file = await shrinkImage(original);
      if (file.size > MAX_BYTES) {
        setError(`${original.name} is too big (10 MB max)`);
        continue;
      }
      const body = new FormData();
      body.set("file", file);
      for (const [k, v] of Object.entries(target)) body.set(k, v);
      try {
        const res = await fetch("/api/files", { method: "POST", body });
        if (!res.ok) setError((await res.json().catch(() => null))?.error ?? `Couldn't upload ${original.name}`);
      } catch {
        setError(`Couldn't upload ${original.name} — check your connection`);
      }
    }
    setStatus(null);
    if (input.current) input.current.value = "";
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className={`btn-secondary cursor-pointer ${status ? "pointer-events-none opacity-60" : ""}`}>
        {status ?? "+ Add photo or PDF"}
        <input
          ref={input}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
          className="sr-only"
          onChange={(e) => e.target.files?.length && upload(e.target.files)}
        />
      </label>
      {error && <span className="text-sm text-red-700">{error}</span>}
    </div>
  );
}
