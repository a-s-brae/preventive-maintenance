"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { ImportKind, ImportPreview } from "@/lib/actions";

type Preview = (kind: ImportKind, text: string) => Promise<ImportPreview>;
type Run = (kind: ImportKind, text: string) => Promise<{ error?: string; created?: number; updated?: number; locationsCreated?: number }>;

const ACTION_LABEL = { create: "New", update: "Update", skip: "Skipped" } as const;
const ACTION_TONE = {
  create: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  update: "bg-accent-50 text-accent-800 ring-accent-200",
  skip: "bg-red-50 text-red-800 ring-red-200",
} as const;

/** Pick a CSV file → see what it would do → import. */
export function ImportForm({ kind, preview, run, listHref }: { kind: ImportKind; preview: Preview; run: Run; listHref: string }) {
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [result, setResult] = useState<ImportPreview | null>(null);
  const [done, setDone] = useState<Awaited<ReturnType<Run>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const noun = kind === "assets" ? "asset" : "part";

  const pick = (f: File | undefined) => {
    setResult(null);
    setDone(null);
    setError(null);
    if (!f) return setFile(null);
    start(async () => {
      try {
        const text = await f.text();
        setFile({ name: f.name, text });
        setResult(await preview(kind, text));
      } catch {
        setError("Couldn't read that file. Save it from Excel as “CSV (Comma delimited)” and try again.");
      }
    });
  };

  const doImport = () =>
    file &&
    start(async () => {
      try {
        const r = await run(kind, file.text);
        if (r.error) setError(r.error);
        else setDone(r);
      } catch {
        setError("The import didn't finish — check your connection and try again. Nothing was changed.");
      }
    });

  if (done) {
    return (
      <div className="space-y-4">
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900 ring-1 ring-emerald-200">
          Imported: <strong>{done.created}</strong> new {done.created === 1 ? noun : `${noun}s`}, <strong>{done.updated}</strong> updated
          {done.locationsCreated ? `, ${done.locationsCreated} new location${done.locationsCreated === 1 ? "" : "s"}` : ""}.
        </p>
        <div className="flex gap-2">
          <Link href={listHref} className="btn-primary">
            Go to {kind}
          </Link>
          <button type="button" className="btn-secondary" onClick={() => pick(undefined)}>
            Import another file
          </button>
        </div>
      </div>
    );
  }

  const importable = result ? result.summary.create + result.summary.update : 0;
  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-neutral-700">CSV file</span>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => pick(e.target.files?.[0])}
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-neutral-200"
        />
      </label>
      {pending && <p className="text-sm text-neutral-500">{done === null && result ? "Importing…" : "Checking the file…"}</p>}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{error}</p>}

      {result && (
        <>
          {result.error || result.errors.length ? (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
              {[result.error, ...result.errors].filter(Boolean).map((e) => (
                <p key={e}>{e}</p>
              ))}
            </div>
          ) : (
            <>
              <div className="rounded-xl bg-white px-4 py-3 text-sm ring-1 ring-neutral-200/70">
                <p>
                  <strong>{file?.name}</strong>: {result.summary.create} new, {result.summary.update} to update
                  {result.summary.skip ? <span className="font-medium text-red-700">, {result.summary.skip} skipped (see below)</span> : null}.
                </p>
                <p className="mt-1 text-xs text-neutral-600">Columns used: {result.columns.join(", ")}.</p>
                {result.ignored.length > 0 && <p className="mt-0.5 text-xs text-neutral-600">Ignored (not recognised): {result.ignored.join(", ")}.</p>}
                {result.newLocations.length > 0 && <p className="mt-0.5 text-xs text-neutral-600">New locations to create: {result.newLocations.join("; ")}.</p>}
                {result.summary.update > 0 && (
                  <p className="mt-0.5 text-xs text-neutral-600">Updates only change the columns in the file; blank cells clear that field.</p>
                )}
              </div>
              <div className="-mx-4 max-h-[28rem] overflow-auto border-y border-neutral-200 sm:mx-0 sm:rounded-lg sm:border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white text-left text-xs text-neutral-500 shadow-[0_1px_0_#e2e8f0]">
                    <tr>
                      <th className="px-3 py-2 font-medium">Line</th>
                      <th className="px-3 py-2 font-medium">Name</th>
                      <th className="px-3 py-2 font-medium">Will</th>
                      <th className="px-3 py-2 font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {result.rows.map((r) => (
                      <tr key={r.line}>
                        <td className="px-3 py-1.5 text-neutral-500 tabular-nums">{r.line}</td>
                        <td className="px-3 py-1.5">{r.name}</td>
                        <td className="px-3 py-1.5">
                          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ring-1 ${ACTION_TONE[r.action]}`}>{ACTION_LABEL[r.action]}</span>
                        </td>
                        <td className={`px-3 py-1.5 text-xs ${r.action === "skip" ? "text-red-700" : "text-neutral-600"}`}>{r.messages.map((m) => m.replace(/^Note: /, "")).join(" · ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={doImport} disabled={pending || importable === 0} className="btn-primary">
                  {pending ? "Importing…" : `Import ${importable} ${importable === 1 ? noun : `${noun}s`}`}
                </button>
                {result.summary.skip > 0 && <span className="text-sm text-neutral-600">Skipped rows aren’t imported. Fix them in the file and import it again.</span>}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
