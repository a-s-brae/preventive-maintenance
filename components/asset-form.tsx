"use client";

import type { Asset } from "@prisma/client";
import type { FormState } from "@/lib/forms";
import { ActionForm, Field, SubmitButton } from "./form";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

export function AssetForm({ action, asset }: { action: Action; asset?: Asset }) {
  const v = (k: keyof Asset) => (asset?.[k] as string | null | undefined) ?? "";
  return (
    <ActionForm action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name *">
          <input name="name" required defaultValue={v("name")} className="input" placeholder="Air Compressor #1" />
        </Field>
        <Field label="Asset tag" hint="Unique ID, e.g. from a nameplate or barcode label">
          <input name="assetTag" defaultValue={v("assetTag")} className="input" placeholder="AC-001" />
        </Field>
        <Field label="Category">
          <input name="category" defaultValue={v("category")} className="input" placeholder="Compressed air" list="categories" />
          <datalist id="categories">
            {["Compressed air", "HVAC", "Material handling", "Electrical", "Plumbing", "Safety", "Building", "Production"].map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Location">
          <input name="location" defaultValue={v("location")} className="input" placeholder="Maintenance room" />
        </Field>
        <Field label="Manufacturer">
          <input name="manufacturer" defaultValue={v("manufacturer")} className="input" />
        </Field>
        <Field label="Model">
          <input name="model" defaultValue={v("model")} className="input" />
        </Field>
        <Field label="Serial number">
          <input name="serialNumber" defaultValue={v("serialNumber")} className="input" />
        </Field>
        <Field label="Status">
          <select name="status" defaultValue={asset?.status ?? "ACTIVE"} className="input">
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive (PM paused)</option>
            <option value="RETIRED">Retired</option>
          </select>
        </Field>
        <Field label="Meter unit" hint="Needed for usage-based PM. Leave blank if the asset has no meter.">
          <input name="meterUnit" defaultValue={v("meterUnit")} className="input" placeholder="hours" list="meter-units" />
          <datalist id="meter-units">
            {["hours", "cycles", "miles", "shots"].map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </Field>
      </div>
      <Field label="Notes">
        <textarea name="notes" defaultValue={v("notes")} rows={3} className="input" />
      </Field>
      <SubmitButton>{asset ? "Save changes" : "Create asset"}</SubmitButton>
    </ActionForm>
  );
}
