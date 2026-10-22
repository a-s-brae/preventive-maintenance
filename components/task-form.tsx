"use client";

import type { PmTask } from "@prisma/client";
import { parseChecklist } from "@/lib/checklist";
import { toDateInput, type FormState } from "@/lib/forms";
import type { UserOption } from "@/lib/queries";
import { ChecklistEditor, type TemplateOption } from "./checklist-editor";
import { ActionForm, Field, SubmitButton } from "./form";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

export function TaskForm({
  action,
  task,
  meterUnit,
  currentMeter,
  users,
  templates,
}: {
  action: Action;
  task?: PmTask;
  meterUnit: string | null;
  currentMeter: number | null;
  users: UserOption[];
  templates: TemplateOption[];
}) {
  return (
    <ActionForm action={action} className="space-y-5">
      <Field label="PM task *">
        <input name="title" required defaultValue={task?.title} className="input" placeholder="Drain tank, check belts" />
      </Field>
      <Field label="Instructions">
        <textarea name="instructions" rows={3} defaultValue={task?.instructions ?? ""} className="input" />
      </Field>
      <div>
        <div className="mb-1 text-sm font-medium text-neutral-700">Checklist</div>
        <p className="mb-2 text-xs text-neutral-500">
          Filled in when the work order is completed. Use pass / fail for inspections and number for readings like pressures — give a reading a min / max and anything outside it is flagged. A failed check or a reading out of limits offers a follow-up repair work order.
        </p>
        <ChecklistEditor initial={parseChecklist(task?.checklist)} templates={templates} initialTemplateId={task?.checklistTemplateId} />
      </div>

      <fieldset className="rounded-xl border border-neutral-200 bg-white p-4">
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
          <Field label="First due date">
            <input name="startDate" type="date" required defaultValue={toDateInput(task?.startDate)} className="input" />
          </Field>
          {meterUnit && (
            <Field label={`Start meter (${meterUnit})`} hint="Usage is counted from here until the first completion">
              <input name="startMeter" type="number" min={0} step="any" defaultValue={task?.startMeter ?? currentMeter ?? ""} className="input" />
            </Field>
          )}
        </div>
        <div className="mt-4 space-y-2 text-sm">
          <div className="font-medium text-neutral-700">After each completion, the next calendar due date is…</div>
          <label className="flex items-start gap-2">
            <input type="radio" name="scheduleBasis" value="COMPLETION" defaultChecked={task?.scheduleBasis !== "FIXED"} className="mt-0.5 size-4" />
            <span>
              <strong className="font-medium">Counted from when it was done</strong>
              <span className="block text-xs text-neutral-500">Done 5 days late → next one is due a full interval after that.</span>
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input type="radio" name="scheduleBasis" value="FIXED" defaultChecked={task?.scheduleBasis === "FIXED"} className="mt-0.5 size-4" />
            <span>
              <strong className="font-medium">On a fixed calendar</strong>
              <span className="block text-xs text-neutral-500">
                Stays on the same dates (e.g. the 1st of every month) however early or late each one is done — good for compliance checks.
              </span>
            </span>
          </label>
        </div>
      </fieldset>

      <fieldset className="rounded-xl border border-neutral-200 bg-white p-4">
        <legend className="px-1 text-sm font-medium">Work orders</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Create the work order (days before due)" hint="Capped at a quarter of the calendar interval">
            <input name="dueSoonDays" type="number" min={0} defaultValue={task?.dueSoonDays ?? 7} className="input w-24" />
          </Field>
          <Field label="Priority">
            <select name="priority" defaultValue={task?.priority ?? "NONE"} className="input">
              <option value="NONE">None</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </Field>
          <Field label="Assign to" hint="Only people who have signed in at least once are listed">
            <select name="defaultAssigneeId" defaultValue={task?.defaultAssigneeId ?? ""} className="input">
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name ?? u.email}
                </option>
              ))}
            </select>
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
      <SubmitButton>{task ? "Save changes" : "Create PM schedule"}</SubmitButton>
    </ActionForm>
  );
}
