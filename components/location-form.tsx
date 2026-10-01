"use client";

import type { Location } from "@prisma/client";
import type { FormState } from "@/lib/forms";
import { ActionForm, Field, SubmitButton } from "./form";
import { TreeOptions } from "./tree-select";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

export function LocationForm({
  action,
  location,
  parents,
  defaultParentId,
}: {
  action: Action;
  location?: Location;
  /** Locations it may sit inside (never itself or its own sub-locations). */
  parents: { id: string; name: string; depth: number }[];
  defaultParentId?: string;
}) {
  return (
    <ActionForm action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name *">
          <input name="name" required defaultValue={location?.name} className="input" placeholder="e.g. Molding, Line 3, Compressor room" />
        </Field>
        <Field label="Inside">
          <select name="parentId" defaultValue={location?.parentId ?? defaultParentId ?? ""} className="input">
            <option value="">— Top level —</option>
            <TreeOptions options={parents} />
          </select>
        </Field>
      </div>
      <Field label="Notes">
        <textarea name="notes" rows={3} defaultValue={location?.notes ?? ""} className="input" placeholder="Address, access instructions…" />
      </Field>
      <SubmitButton>{location ? "Save changes" : "Create location"}</SubmitButton>
    </ActionForm>
  );
}

/** Delete button for a location; shows why if it isn't empty. */
export function DeleteLocationForm({ action }: { action: Action }) {
  return (
    <ActionForm action={action} className="flex flex-col items-end gap-2">
      <SubmitButton className="btn-danger">Delete location</SubmitButton>
    </ActionForm>
  );
}
