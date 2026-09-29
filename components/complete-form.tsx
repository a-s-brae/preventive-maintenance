"use client";

import type { ChecklistItem } from "@/lib/checklist";
import { toDateInput, type FormState } from "@/lib/forms";
import { ActionForm, Field, SubmitButton } from "./form";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

export function CompleteForm({
  action,
  checklist,
  meterUnit,
  currentMeter,
  meterRequired,
}: {
  action: Action;
  checklist: ChecklistItem[];
  meterUnit: string | null;
  currentMeter: number | null;
  meterRequired: boolean;
}) {
  return (
    <ActionForm action={action} className="space-y-5">
      {checklist.length > 0 && (
        <fieldset className="rounded-md border border-slate-200">
          <legend className="ml-3 px-1 text-sm font-medium">Checklist</legend>
          <ul className="divide-y divide-slate-100">
            {checklist.map((item, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <ChecklistInput item={item} index={i} />
              </li>
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
      <SubmitButton>Mark complete</SubmitButton>
    </ActionForm>
  );
}

function ChecklistInput({ item, index }: { item: ChecklistItem; index: number }) {
  const name = `check-${index}`;
  switch (item.type) {
    case "CHECK":
      return (
        <label className="flex items-start gap-2">
          <input type="checkbox" name={name} className="mt-0.5 size-4" />
          {item.label}
        </label>
      );
    case "PASS_FAIL":
      return (
        <>
          <span className="min-w-0 flex-1">{item.label}</span>
          <span className="flex shrink-0 gap-1" role="radiogroup" aria-label={item.label}>
            {(["PASS", "FAIL", "NA"] as const).map((v) => (
              <label key={v} className="cursor-pointer">
                <input type="radio" name={name} value={v} className="peer sr-only" />
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
      );
    case "NUMBER":
      return (
        <label className="flex w-full flex-wrap items-center justify-between gap-2">
          <span>{item.label}</span>
          <span className="flex items-center gap-2">
            <input name={name} type="number" step="any" className="input w-32" />
            {item.unit && <span className="text-slate-500">{item.unit}</span>}
          </span>
        </label>
      );
    case "TEXT":
      return (
        <label className="flex w-full flex-wrap items-center justify-between gap-2">
          <span>{item.label}</span>
          <input name={name} className="input sm:w-64" />
        </label>
      );
  }
}
