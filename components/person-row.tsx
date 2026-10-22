"use client";

import type { Role } from "@prisma/client";
import type { FormState } from "@/lib/forms";
import { ROLE_LABEL } from "@/lib/permissions";
import { ActionForm, SubmitButton } from "./form";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

export function PersonRow({
  action,
  person,
  isMe,
  isNew = false,
}: {
  action: Action;
  person: { name: string | null; email: string; role: Role; active: boolean; emailDigest: boolean };
  isMe: boolean;
  /** Signed in lately and still a requester: probably waiting for a role. */
  isNew?: boolean;
}) {
  return (
    <ActionForm action={action} className="grid items-center gap-2 py-3 sm:grid-cols-[1.4fr_1fr_auto_auto_auto] sm:gap-4">
      <div className="min-w-0">
        <input name="name" defaultValue={person.name ?? ""} placeholder="Name" aria-label={`Name for ${person.email}`} className="input py-1.5" />
        <div className="mt-0.5 truncate text-xs text-neutral-500">
          {person.email}
          {isMe && " (you)"}
          {isNew && <span className="ml-1.5 rounded-md bg-pastel-blue px-1.5 py-px text-[11px] font-medium text-accent-800">New</span>}
        </div>
      </div>
      <select name="role" defaultValue={person.role} aria-label={`Role for ${person.email}`} className="input py-1.5">
        {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
          <option key={r} value={r}>
            {ROLE_LABEL[r]}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-2 text-sm whitespace-nowrap">
        <input type="checkbox" name="active" defaultChecked={person.active} className="size-4" /> Active
      </label>
      <label className="flex items-center gap-2 text-sm whitespace-nowrap">
        <input type="checkbox" name="emailDigest" defaultChecked={person.emailDigest} className="size-4" /> Daily email
      </label>
      <SubmitButton className="btn-secondary py-1.5">Save</SubmitButton>
    </ActionForm>
  );
}
