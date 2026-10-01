"use client";

import type { Priority } from "@prisma/client";
import type { FormState } from "@/lib/forms";
import type { UserOption } from "@/lib/queries";
import { ActionForm, Field, SubmitButton } from "./form";
import { TreeOptions } from "./tree-select";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;
type Option = { id: string; name: string; depth: number };

/** Anyone reporting a problem. Kept short: what, where, how bad. */
export function RequestForm({
  action,
  assets,
  locations,
  defaultAssetId,
}: {
  action: Action;
  assets: Option[];
  locations: Option[];
  defaultAssetId?: string;
}) {
  return (
    <ActionForm action={action} className="space-y-4">
      <Field label="What's wrong? *">
        <input name="title" required className="input" placeholder="e.g. Air leak at the dryer inlet" />
      </Field>
      <Field label="Details">
        <textarea name="description" rows={4} className="input" placeholder="What you noticed, when it started, anything you tried…" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Which equipment?" hint="Leave blank if you're not sure — whoever reviews it can fill it in">
          <select name="assetId" defaultValue={defaultAssetId ?? ""} className="input">
            <option value="">— Not sure / not equipment —</option>
            <TreeOptions options={assets} />
          </select>
        </Field>
        <Field label="Where?">
          <select name="locationId" defaultValue="" className="input">
            <option value="">— Same as the equipment —</option>
            <TreeOptions options={locations} />
          </select>
        </Field>
        <Field label="How urgent?">
          <select name="priority" defaultValue="MEDIUM" className="input">
            <option value="LOW">Low — when someone gets a chance</option>
            <option value="MEDIUM">Medium — this week</option>
            <option value="HIGH">High — affecting production or safety</option>
          </select>
        </Field>
      </div>
      <label className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-900 ring-1 ring-red-200">
        <input type="checkbox" name="assetDown" className="mt-0.5 size-4" />
        <span>
          <strong className="font-medium">The machine is down</strong> — it's stopped or can't be used. (Starts logging downtime now.)
        </span>
      </label>
      <SubmitButton>Send request</SubmitButton>
    </ActionForm>
  );
}

export function ApproveForm({
  action,
  assets,
  users,
  defaults,
}: {
  action: Action;
  assets: Option[];
  users: UserOption[];
  defaults: { assetId: string | null; priority: Priority };
}) {
  return (
    <ActionForm action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Equipment *">
          <select name="assetId" required defaultValue={defaults.assetId ?? ""} className="input">
            <option value="" disabled>
              Pick the asset…
            </option>
            <TreeOptions options={assets} />
          </select>
        </Field>
        <Field label="Priority">
          <select name="priority" defaultValue={defaults.priority} className="input">
            <option value="NONE">None</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>
        </Field>
        <Field label="Assign to">
          <select name="assignedToId" defaultValue="" className="input">
            <option value="">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name ?? u.email}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Due date">
          <input name="dueDate" type="date" className="input" />
        </Field>
      </div>
      <Field label="Note (added to the work order)">
        <input name="note" className="input" placeholder="Optional" />
      </Field>
      <SubmitButton>Approve &amp; create work order</SubmitButton>
    </ActionForm>
  );
}

export function RejectForm({ action }: { action: Action }) {
  return (
    <ActionForm action={action} className="space-y-3">
      <Field label="Reason *" hint="Shown to the person who reported it">
        <input name="note" required className="input" placeholder="e.g. Duplicate of REQ-0012, or already fixed" />
      </Field>
      <SubmitButton className="btn-danger">Reject request</SubmitButton>
    </ActionForm>
  );
}
