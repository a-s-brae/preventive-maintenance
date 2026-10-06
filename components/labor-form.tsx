"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toDateInput, type FormState } from "@/lib/forms";
import { FormError, SubmitButton } from "./form";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

/** Log time after the fact. Collapsed behind a link until needed. */
export function AddLaborForm({ action }: { action: Action }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state && !state.error) {
      ref.current?.reset();
      setOpen(false);
    }
  }, [state]);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm text-sky-700 hover:underline">
        + Log time manually
      </button>
    );
  }
  return (
    <form ref={ref} action={formAction} className="flex flex-wrap items-end gap-2">
      <label>
        <span className="mb-1 block text-sm font-medium text-slate-700">Hours</span>
        <input name="hours" type="number" min="0" max="24" className="input w-20" />
      </label>
      <label>
        <span className="mb-1 block text-sm font-medium text-slate-700">Minutes</span>
        <input name="minutes" type="number" min="0" max="59" className="input w-20" />
      </label>
      <label>
        <span className="mb-1 block text-sm font-medium text-slate-700">Date</span>
        <input name="date" type="date" required defaultValue={toDateInput(new Date())} className="input" />
      </label>
      <label className="min-w-0 flex-1">
        <span className="mb-1 block text-sm font-medium text-slate-700">Note</span>
        <input name="note" placeholder="Optional" className="input" />
      </label>
      <SubmitButton className="btn-secondary">Log time</SubmitButton>
      <div className="basis-full">
        <FormError error={state?.error} />
      </div>
    </form>
  );
}
