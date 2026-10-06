"use client";

import type { ChecklistItem } from "@/lib/checklist";
import type { FormState } from "@/lib/forms";
import { ChecklistEditor } from "./checklist-editor";
import { ActionForm, Field, SubmitButton } from "./form";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

export function TemplateForm({
  action,
  name,
  description,
  items,
  usedBy = 0,
}: {
  action: Action;
  name?: string;
  description?: string | null;
  items: ChecklistItem[];
  /** PM schedules that follow this template. */
  usedBy?: number;
}) {
  return (
    <ActionForm action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Template name *">
          <input name="name" required defaultValue={name} className="input" placeholder="e.g. Forklift pre-shift inspection" />
        </Field>
        <Field label="Description">
          <input name="description" defaultValue={description ?? ""} className="input" placeholder="What it's for" />
        </Field>
      </div>
      <div>
        <div className="mb-1 text-sm font-medium text-slate-700">Checklist *</div>
        <p className="mb-2 text-xs text-slate-500">Pass / fail for inspections, number for readings (with an OK range), text for notes.</p>
        <ChecklistEditor initial={items} />
      </div>
      {usedBy > 0 && (
        <p className="rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-900 ring-1 ring-sky-200">
          {usedBy} PM {usedBy === 1 ? "schedule follows" : "schedules follow"} this template. Saving updates {usedBy === 1 ? "its" : "their"} checklist, and
          any of their work orders that haven’t been started.
        </p>
      )}
      <SubmitButton>Save template</SubmitButton>
    </ActionForm>
  );
}
