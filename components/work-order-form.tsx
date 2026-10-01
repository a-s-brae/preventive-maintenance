"use client";

import type { Asset, WorkOrder } from "@prisma/client";
import { toDateInput, type FormState } from "@/lib/forms";
import type { UserOption } from "@/lib/queries";
import { ActionForm, Field, SubmitButton } from "./form";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

/** Create a repair / inspection work order, or edit any work order's details. */
export function WorkOrderForm({
  action,
  workOrder,
  assets,
  users,
  defaultAssetId,
}: {
  action: Action;
  workOrder?: WorkOrder;
  assets: (Pick<Asset, "id" | "name" | "assetTag"> & { depth?: number })[];
  users: UserOption[];
  defaultAssetId?: string;
}) {
  const isPm = workOrder?.type === "PM";
  return (
    <ActionForm action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {isPm ? (
          <>
            <input type="hidden" name="type" value="REPAIR" />
            <input type="hidden" name="assetId" value={workOrder.assetId} />
          </>
        ) : (
          <>
            <Field label="Type">
              <select name="type" defaultValue={workOrder?.type ?? "REPAIR"} className="input">
                <option value="REPAIR">Repair</option>
                <option value="INSPECTION">Inspection</option>
              </select>
            </Field>
            <Field label="Asset *">
              <select name="assetId" required defaultValue={workOrder?.assetId ?? defaultAssetId ?? ""} className="input">
                <option value="" disabled>
                  Pick an asset…
                </option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {"\u00a0\u00a0\u00a0".repeat(a.depth ?? 0)}
                    {a.depth ? "└ " : ""}
                    {a.name}
                    {a.assetTag ? ` (${a.assetTag})` : ""}
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}
      </div>
      <Field label="Title *">
        <input name="title" required defaultValue={workOrder?.title} className="input" placeholder="e.g. Air leak at dryer inlet" />
      </Field>
      <Field label="Description">
        <textarea name="description" rows={4} defaultValue={workOrder?.description ?? ""} className="input" placeholder="What's wrong, what needs doing…" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Priority">
          <select name="priority" defaultValue={workOrder?.priority ?? "NONE"} className="input">
            <option value="NONE">None</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>
        </Field>
        <Field label="Due date">
          <input name="dueDate" type="date" defaultValue={workOrder?.dueDate ? toDateInput(workOrder.dueDate) : ""} className="input" />
        </Field>
        <Field label="Assign to">
          <select name="assignedToId" defaultValue={workOrder?.assignedToId ?? ""} className="input">
            <option value="">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name ?? u.email}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {!workOrder && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="assetDown" className="size-4" />
          The asset is <strong className="font-medium text-red-700">down</strong> right now (starts logging downtime)
        </label>
      )}
      <SubmitButton>{workOrder ? "Save changes" : "Create work order"}</SubmitButton>
    </ActionForm>
  );
}
