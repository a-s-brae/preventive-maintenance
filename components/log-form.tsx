"use client";

import { toDateInput, type FormState } from "@/lib/forms";
import { ActionForm, Field, SubmitButton } from "./form";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

/** Completes a PM task (checklist given) or logs ad-hoc work (no checklist). */
export function LogForm({
  action,
  checklist,
  meterUnit,
  currentMeter,
  meterRequired,
}: {
  action: Action;
  checklist?: string[];
  meterUnit: string | null;
  currentMeter: number | null;
  meterRequired?: boolean;
}) {
  const isPm = checklist !== undefined;
  return (
    <ActionForm action={action} className="space-y-5">
      {isPm && checklist.length > 0 && (
        <fieldset className="space-y-2 rounded-md border border-slate-200 p-4">
          <legend className="px-1 text-sm font-medium">Checklist</legend>
          {checklist.map((item, i) => (
            <label key={i} className="flex items-start gap-2 text-sm">
              <input type="checkbox" name={`check-${i}`} className="mt-0.5 size-4" />
              {item}
            </label>
          ))}
        </fieldset>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {!isPm && (
          <Field label="Type">
            <select name="kind" defaultValue="REPAIR" className="input">
              <option value="REPAIR">Repair</option>
              <option value="INSPECTION">Inspection</option>
            </select>
          </Field>
        )}
        <Field label="Date performed">
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
      <SubmitButton>{isPm ? "Mark complete" : "Save log entry"}</SubmitButton>
    </ActionForm>
  );
}
