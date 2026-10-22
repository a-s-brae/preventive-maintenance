"use client";

import Link from "next/link";
import type { Asset } from "@prisma/client";
import type { FormState } from "@/lib/forms";
import { ActionForm, Field, SubmitButton } from "./form";
import { TreeOptions } from "./tree-select";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;
type Option = { id: string; name: string; depth: number };

export function AssetForm({
  action,
  asset,
  locations,
  parents,
  defaults,
}: {
  action: Action;
  asset?: Asset;
  locations: Option[];
  /** Assets this one may sit under (never itself or its own sub-assets). */
  parents: Option[];
  defaults?: { locationId?: string; parentId?: string };
}) {
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
        <Field label="Location">
          <select name="locationId" defaultValue={asset?.locationId ?? defaults?.locationId ?? ""} className="input">
            <option value="">— No location —</option>
            <TreeOptions options={locations} />
          </select>
          <Link href="/locations" className="mt-1 inline-block text-xs text-accent-700 hover:underline">
            Manage locations
          </Link>
        </Field>
        <Field label="Part of (parent asset)" hint="E.g. a dryer that belongs to a press">
          <select name="parentId" defaultValue={asset?.parentId ?? defaults?.parentId ?? ""} className="input">
            <option value="">— None (top level) —</option>
            <TreeOptions options={parents} />
          </select>
        </Field>
        <Field label="Category">
          <input name="category" defaultValue={v("category")} className="input" placeholder="Compressed air" list="categories" />
          <datalist id="categories">
            {["Compressed air", "HVAC", "Material handling", "Electrical", "Plumbing", "Safety", "Building", "Production"].map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Status">
          <select name="status" defaultValue={asset?.status ?? "ACTIVE"} className="input">
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive (PM paused)</option>
            <option value="RETIRED">Retired</option>
          </select>
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
