"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/forms";
import { FormError, SubmitButton } from "./form";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

export function MeterForm({ action, meterUnit }: { action: Action; meterUnit: string }) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-2">
      <div className="flex gap-2">
        <input name="value" type="number" step="any" min={0} required placeholder={`New reading (${meterUnit})`} className="input" />
        <SubmitButton className="btn-secondary shrink-0">Record</SubmitButton>
      </div>
      <FormError error={state?.error} />
    </form>
  );
}
