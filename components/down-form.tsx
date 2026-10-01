"use client";

import { useState } from "react";
import type { FormState } from "@/lib/forms";
import { ActionForm, SubmitButton } from "./form";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

/** "Mark down" button that asks for an optional reason first. */
export function DownForm({ action }: { action: Action }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-danger">
        Mark down
      </button>
    );
  }
  return (
    <ActionForm action={action} className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
      <input name="reason" autoFocus placeholder="Why is it down? (optional)" className="input min-w-0 flex-1 sm:w-72" />
      <SubmitButton className="btn-danger">Mark down</SubmitButton>
      <button type="button" onClick={() => setOpen(false)} className="btn-secondary">
        Cancel
      </button>
    </ActionForm>
  );
}
