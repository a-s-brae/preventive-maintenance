"use client";

import type { Part } from "@prisma/client";
import { useActionState, useEffect, useRef } from "react";
import type { FormState } from "@/lib/forms";
import { formatQty } from "@/lib/parts";
import { ActionForm, Field, FormError, SubmitButton } from "./form";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

/** A small form that clears itself after it succeeds (restock, count, use part). */
function QuickForm({ action, children, className }: { action: Action; children: React.ReactNode; className?: string }) {
  const [state, formAction] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state && !state.error) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      <div className="basis-full">
        <FormError error={state?.error} />
      </div>
    </form>
  );
}

export function UsePartForm({ action, parts }: { action: Action; parts: Pick<Part, "id" | "name" | "partNumber" | "quantity" | "unit">[] }) {
  if (parts.length === 0) return <p className="text-sm text-slate-500">No parts in the parts list yet.</p>;
  return (
    <QuickForm action={action} className="flex flex-wrap items-end gap-2">
      <label className="min-w-0 flex-1">
        <span className="mb-1 block text-sm font-medium text-slate-700">Use a part</span>
        <select name="partId" required defaultValue="" className="input">
          <option value="" disabled>
            Pick a part…
          </option>
          {parts.map((p) => (
            <option key={p.id} value={p.id} disabled={p.quantity <= 0}>
              {p.name}
              {p.partNumber ? ` (${p.partNumber})` : ""} — {formatQty(p.quantity)} {p.unit} on hand
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="mb-1 block text-sm font-medium text-slate-700">Qty</span>
        <input name="quantity" type="number" step="any" min="0" defaultValue="1" required className="input w-24" />
      </label>
      <SubmitButton className="btn-secondary">Add</SubmitButton>
    </QuickForm>
  );
}

export function RestockForm({ action, unit, unitCost }: { action: Action; unit: string; unitCost: number | null }) {
  return (
    <QuickForm action={action} className="flex flex-wrap items-end gap-2">
      <label>
        <span className="mb-1 block text-sm font-medium text-slate-700">Received ({unit})</span>
        <input name="quantity" type="number" step="any" min="0" required className="input w-28" />
      </label>
      <label>
        <span className="mb-1 block text-sm font-medium text-slate-700">Unit cost</span>
        <input name="unitCost" type="number" step="0.01" min="0" defaultValue={unitCost ?? ""} placeholder="$" className="input w-28" />
      </label>
      <label className="min-w-0 flex-1">
        <span className="mb-1 block text-sm font-medium text-slate-700">Note</span>
        <input name="note" placeholder="PO / vendor (optional)" className="input" />
      </label>
      <SubmitButton className="btn-primary">Restock</SubmitButton>
    </QuickForm>
  );
}

export function CountForm({ action, unit }: { action: Action; unit: string }) {
  return (
    <QuickForm action={action} className="flex flex-wrap items-end gap-2">
      <label>
        <span className="mb-1 block text-sm font-medium text-slate-700">Counted ({unit})</span>
        <input name="counted" type="number" step="any" min="0" required className="input w-28" />
      </label>
      <label className="min-w-0 flex-1">
        <span className="mb-1 block text-sm font-medium text-slate-700">Note</span>
        <input name="note" placeholder="e.g. Monthly count" className="input" />
      </label>
      <SubmitButton className="btn-secondary">Set count</SubmitButton>
    </QuickForm>
  );
}

export function PartForm({ action, part }: { action: Action; part?: Part }) {
  const v = (k: keyof Part) => (part?.[k] as string | number | null | undefined) ?? "";
  return (
    <ActionForm action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name *">
          <input name="name" required defaultValue={v("name")} className="input" placeholder="e.g. Compressor oil filter" />
        </Field>
        <Field label="Part number" hint="Manufacturer or your own number; must be unique">
          <input name="partNumber" defaultValue={v("partNumber")} className="input" />
        </Field>
        <Field label="Unit" hint="How it's counted: ea, ft, qt, box…">
          <input name="unit" defaultValue={v("unit") || "ea"} className="input w-28" list="units" />
          <datalist id="units">
            {["ea", "ft", "in", "qt", "gal", "lb", "box", "pair", "set"].map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </Field>
        {!part && (
          <Field label="On hand now" hint="Starting stock">
            <input name="quantity" type="number" step="any" min="0" className="input w-28" />
          </Field>
        )}
        <Field label="Low-stock level" hint="Shows as low at or below this">
          <input name="minQuantity" type="number" step="any" min="0" defaultValue={v("minQuantity")} className="input w-28" />
        </Field>
        <Field label="Unit cost ($)">
          <input name="unitCost" type="number" step="0.01" min="0" defaultValue={v("unitCost")} className="input w-28" />
        </Field>
        <Field label="Stored at" hint="e.g. Crib A, bin 12">
          <input name="storageLocation" defaultValue={v("storageLocation")} className="input" />
        </Field>
        <Field label="Vendor">
          <input name="vendor" defaultValue={v("vendor")} className="input" />
        </Field>
      </div>
      <Field label="Description">
        <textarea name="description" rows={2} defaultValue={v("description")} className="input" />
      </Field>
      <Field label="Notes">
        <textarea name="notes" rows={2} defaultValue={v("notes")} className="input" />
      </Field>
      {part && (
        <label className="flex items-center gap-2 text-sm">
          {/* An unticked box sends nothing; this hidden "false" is what's sent then. */}
          <input type="hidden" name="active" value="false" />
          <input type="checkbox" name="active" defaultChecked={part.active} className="size-4" />
          Active (uncheck to retire this part — it keeps its history)
        </label>
      )}
      <SubmitButton>{part ? "Save changes" : "Create part"}</SubmitButton>
    </ActionForm>
  );
}
