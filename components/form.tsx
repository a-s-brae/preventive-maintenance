"use client";

import { createContext, startTransition, use, useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/lib/forms";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

const PendingContext = createContext(false);

/** A form bound to a server action that shows its error and keeps the user's
 *  input when validation fails. (A plain `<form action>` is reset by React 19
 *  after every submit, which would wipe the form on a validation error.) */
export function ActionForm({ action, className, children }: { action: Action; className?: string; children: React.ReactNode }) {
  const [state, dispatch, pending] = useActionState(action, undefined);
  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => dispatch(fd));
      }}
    >
      <PendingContext value={pending}>
        <FormError error={state?.error} />
        {children}
      </PendingContext>
    </form>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function SubmitButton({ children, className = "btn-primary" }: { children: React.ReactNode; className?: string }) {
  // Works inside <ActionForm> and inside a plain <form action>.
  const pending = use(PendingContext) || useFormStatus().pending;
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? "Saving…" : children}
    </button>
  );
}

export function FormError({ error }: { error?: string }) {
  if (!error) return null;
  return <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{error}</p>;
}

/** A button that asks for confirmation before running a server action. */
export function ConfirmButton({ action, message, children }: { action: () => Promise<void>; message: string; children: React.ReactNode }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      <button type="submit" className="btn-danger">
        {children}
      </button>
    </form>
  );
}
