"use client";

import type { PmTask } from "@prisma/client";
import { toDateInput, type FormState } from "@/lib/forms";
import { ActionForm, Field, SubmitButton } from "./form";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

export function TaskForm({
  action,
  task,
  meterUnit,
  currentMeter,
}: {
  action: Action;
  task?: PmTask;
  meterUnit: string | null;
  currentMeter: number | null;
}) {
  return (
    <ActionForm action={action} className="space-y-5">
      <Field label="Task *">
        <input name="title" required defaultValue={task?.title} className="input" placeholder="Drain tank, check belts" />
      </Field>
      <Field label="Instructions">
        <textarea name="instructions" rows={3} defaultValue={task?.instructions ?? ""} className="input" />
      </Field>
      <Field label="Checklist" hint="One item per line. Techs tick these off when completing the PM.">
        <textarea name="checklist" rows={5} defaultValue={task?.checklist.join("\n")} className="input font-mono text-sm" />
      </Field>

      <fieldset className="rounded-md border border-slate-200 p-4">
        <legend className="px-1 text-sm font-medium">Schedule — due at whichever comes first</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex gap-2">
            <Field label="Every">
              <input name="calendarEvery" type="number" min={1} defaultValue={task?.calendarEvery ?? ""} className="input w-24" />
            </Field>
            <Field label="Unit">
              <select name="calendarUnit" defaultValue={task?.calendarUnit ?? ""} className="input">
                <option value="">—</option>
                <option value="DAY">Days</option>
                <option value="WEEK">Weeks</option>
                <option value="MONTH">Months</option>
                <option value="YEAR">Years</option>
              </select>
            </Field>
          </div>
          <Field
            label={`Every (${meterUnit ?? "usage"})`}
            hint={meterUnit ? undefined : "Set a meter unit on the asset to use usage-based PM"}
          >
            <input
              name="usageEvery"
              type="number"
              min={0}
              step="any"
              disabled={!meterUnit}
              defaultValue={task?.usageEvery ?? ""}
              className="input"
            />
          </Field>
          <Field label="Start date" hint="First due date counts from here until the task is completed once">
            <input name="startDate" type="date" required defaultValue={toDateInput(task?.startDate)} className="input" />
          </Field>
          {meterUnit && (
            <Field label={`Start meter (${meterUnit})`} hint="First usage due counts from here">
              <input name="startMeter" type="number" min={0} step="any" defaultValue={task?.startMeter ?? currentMeter ?? ""} className="input" />
            </Field>
          )}
          <Field label="Due-soon warning (days)" hint="Capped at a quarter of the calendar interval">
            <input name="dueSoonDays" type="number" min={0} defaultValue={task?.dueSoonDays ?? 7} className="input w-24" />
          </Field>
          <Field label="Estimated minutes">
            <input name="estimatedMinutes" type="number" min={1} defaultValue={task?.estimatedMinutes ?? ""} className="input w-24" />
          </Field>
        </div>
      </fieldset>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={task?.active ?? true} className="size-4" />
        Active (uncheck to pause this PM)
      </label>
      <SubmitButton>{task ? "Save changes" : "Create PM task"}</SubmitButton>
    </ActionForm>
  );
}
