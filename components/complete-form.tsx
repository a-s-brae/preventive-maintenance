"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChecklistItem, ChecklistResult } from "@/lib/checklist";
import { toDateInput, type FormState } from "@/lib/forms";
import { ActionForm, Field, SubmitButton } from "./form";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;
type SaveAnswer = (index: number, raw: string, note: string) => Promise<{ error?: string; started?: boolean }>;
type Draft = Pick<ChecklistResult, "value" | "note"> | undefined;
type SaveState = { kind: "idle" | "saving" | "saved" } | { kind: "error"; message: string };

/** How long to wait after typing stops before saving a number, text or note. */
const TYPING_DELAY_MS = 700;

export function CompleteForm({
  action,
  saveAnswer,
  checklist,
  drafts,
  meterUnit,
  currentMeter,
  meterRequired,
  assetDown = false,
}: {
  action: Action;
  saveAnswer: SaveAnswer;
  checklist: ChecklistItem[];
  drafts: Draft[];
  meterUnit: string | null;
  currentMeter: number | null;
  meterRequired: boolean;
  /** The asset has open downtime: offer to mark it back up. */
  assetDown?: boolean;
}) {
  const router = useRouter();
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });
  const pending = useRef(0);

  const onSave = useCallback(
    async (index: number, raw: string, note: string) => {
      pending.current++;
      setSaveState({ kind: "saving" });
      try {
        const res = await saveAnswer(index, raw, note);
        pending.current--;
        if (res.error) return setSaveState({ kind: "error", message: res.error });
        if (pending.current === 0) setSaveState({ kind: "saved" });
        // The first answer moved it to In progress: refresh the header.
        if (res.started) router.refresh();
      } catch {
        pending.current = Math.max(0, pending.current - 1);
        setSaveState({ kind: "error", message: "Couldn't save — check your connection. Your answers are still on this page." });
      }
    },
    [saveAnswer, router],
  );

  return (
    <ActionForm action={action} className="space-y-5">
      {checklist.length > 0 && (
        <fieldset className="rounded-md border border-slate-200">
          <legend className="ml-3 px-1 text-sm font-medium">Checklist</legend>
          <div className="-mt-1 px-4 pb-1 text-xs" aria-live="polite">
            <SaveIndicator state={saveState} />
          </div>
          <ul className="divide-y divide-slate-100">
            {checklist.map((item, i) => (
              <ChecklistRow key={i} item={item} index={i} draft={drafts[i]} onSave={onSave} />
            ))}
          </ul>
        </fieldset>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date done">
          <input name="performedAt" type="date" required defaultValue={toDateInput(new Date())} className="input" />
        </Field>
        {meterUnit && (
          <Field
            label={`Meter reading (${meterUnit})${meterRequired ? " *" : ""}`}
            hint={currentMeter != null ? `Last reading: ${currentMeter}` : undefined}
          >
            <input name="meterReading" type="number" step="any" min={currentMeter ?? 0} required={meterRequired} className="input" />
          </Field>
        )}
      </div>
      <Field label="Notes">
        <textarea name="notes" rows={4} className="input" placeholder="What was done, parts used, issues found…" />
      </Field>
      {assetDown && (
        <label className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900 ring-1 ring-emerald-200">
          <input type="checkbox" name="assetUp" defaultChecked className="size-4" />
          The asset is back up and running (ends the downtime)
        </label>
      )}
      <SubmitButton>Mark complete</SubmitButton>
    </ActionForm>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  switch (state.kind) {
    case "idle":
      return <span className="text-slate-500">Answers save as you go.</span>;
    case "saving":
      return <span className="text-slate-500">Saving…</span>;
    case "saved":
      return <span className="text-emerald-700">✓ All answers saved</span>;
    case "error":
      return <span className="font-medium text-red-700">{state.message}</span>;
  }
}

/** The raw form value for an answer: what the input itself would submit. */
function toRaw(item: ChecklistItem, value: ChecklistResult["value"] | undefined): string {
  if (value == null) return "";
  if (item.type === "CHECK") return value === true ? "on" : "";
  return String(value);
}

function ChecklistRow({
  item,
  index,
  draft,
  onSave,
}: {
  item: ChecklistItem;
  index: number;
  draft: Draft;
  onSave: (index: number, raw: string, note: string) => Promise<void>;
}) {
  const [raw, setRaw] = useState(() => toRaw(item, draft?.value));
  const [note, setNote] = useState(draft?.note ?? "");
  const [showNote, setShowNote] = useState(!!draft?.note);
  const latest = useRef({ raw, note });
  const lastSaved = useRef({ raw, note });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Saves for one item run in order, so a slow earlier save can't overwrite a newer answer.
  const queue = useRef<Promise<void>>(Promise.resolve());

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const { raw: r, note: n } = latest.current;
    if (r === lastSaved.current.raw && n === lastSaved.current.note) return;
    lastSaved.current = { raw: r, note: n };
    queue.current = queue.current.then(() => onSave(index, r, n));
  }, [index, onSave]);

  const change = (next: { raw?: string; note?: string }, delayed: boolean) => {
    latest.current = { ...latest.current, ...next };
    if (next.raw !== undefined) setRaw(next.raw);
    if (next.note !== undefined) setNote(next.note);
    if (timer.current) clearTimeout(timer.current);
    if (delayed) timer.current = setTimeout(flush, TYPING_DELAY_MS);
    else flush();
  };

  // Save anything still waiting when the page is left.
  useEffect(() => () => flush(), [flush]);

  const name = `check-${index}`;

  return (
    <li className="px-4 py-2.5 text-sm">
      <div className="flex items-center justify-between gap-3">
        {item.type === "CHECK" && (
          <label className="flex min-w-0 flex-1 items-start gap-2">
            <input
              type="checkbox"
              name={name}
              checked={raw === "on"}
              onChange={(e) => change({ raw: e.target.checked ? "on" : "" }, false)}
              className="mt-0.5 size-4"
            />
            {item.label}
          </label>
        )}
        {item.type === "PASS_FAIL" && (
          <>
            <span className="min-w-0 flex-1">{item.label}</span>
            <span className="flex shrink-0 gap-1" role="radiogroup" aria-label={item.label}>
              {(["PASS", "FAIL", "NA"] as const).map((v) => (
                <label key={v} className="cursor-pointer">
                  <input type="radio" name={name} value={v} checked={raw === v} onChange={() => change({ raw: v }, false)} className="peer sr-only" />
                  <span
                    className={`inline-block rounded-md px-3 py-1 text-xs font-medium ring-1 ring-slate-300 ring-inset peer-focus-visible:ring-2 peer-focus-visible:ring-sky-500 ${
                      v === "PASS"
                        ? "peer-checked:bg-emerald-600 peer-checked:text-white peer-checked:ring-emerald-600"
                        : v === "FAIL"
                          ? "peer-checked:bg-red-600 peer-checked:text-white peer-checked:ring-red-600"
                          : "peer-checked:bg-slate-600 peer-checked:text-white peer-checked:ring-slate-600"
                    }`}
                  >
                    {v === "PASS" ? "Pass" : v === "FAIL" ? "Fail" : "N/A"}
                  </span>
                </label>
              ))}
            </span>
          </>
        )}
        {item.type === "NUMBER" && (
          <label className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2">
            <span>{item.label}</span>
            <span className="flex items-center gap-2">
              <input
                name={name}
                type="number"
                step="any"
                value={raw}
                onChange={(e) => change({ raw: e.target.value }, true)}
                onBlur={flush}
                className="input w-32"
              />
              {item.unit && <span className="text-slate-500">{item.unit}</span>}
            </span>
          </label>
        )}
        {item.type === "TEXT" && (
          <label className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2">
            <span>{item.label}</span>
            <input name={name} value={raw} onChange={(e) => change({ raw: e.target.value }, true)} onBlur={flush} className="input sm:w-64" />
          </label>
        )}
        {!showNote && (
          <button type="button" onClick={() => setShowNote(true)} className="shrink-0 text-xs text-sky-700 hover:underline">
            + Note
          </button>
        )}
      </div>
      {showNote ? (
        <input
          name={`note-${index}`}
          value={note}
          onChange={(e) => change({ note: e.target.value }, true)}
          onBlur={flush}
          aria-label={`Note for ${item.label}`}
          placeholder="Note (e.g. what you found)"
          autoFocus={!draft?.note}
          className="input mt-2 text-sm"
        />
      ) : (
        <input type="hidden" name={`note-${index}`} value="" />
      )}
    </li>
  );
}
