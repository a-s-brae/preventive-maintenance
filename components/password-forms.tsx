"use client";

import type { Role } from "@prisma/client";
import { PASSWORD_MIN_LENGTH, type FormState } from "@/lib/forms";
import { ROLE_LABEL } from "@/lib/permissions";
import { ActionForm, Field, SubmitButton } from "./form";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

const passwordHint = `At least ${PASSWORD_MIN_LENGTH} characters. A few words together is easy to remember.`;

/** People page: add someone with a starting password. */
export function AddPersonForm({ action }: { action: Action }) {
  return (
    <ActionForm action={action} className="grid gap-3 sm:grid-cols-2">
      <Field label="Work email">
        <input name="email" type="email" required autoComplete="off" className="input" />
      </Field>
      <Field label="Name">
        <input name="name" autoComplete="off" className="input" />
      </Field>
      <Field label="Role">
        <select name="role" defaultValue="REQUESTER" className="input">
          {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Starting password" hint={`${passwordHint} Give it to them; they can change it on their Account page.`}>
        <input name="password" type="text" required minLength={PASSWORD_MIN_LENGTH} autoComplete="new-password" className="input" />
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton>Add person</SubmitButton>
      </div>
    </ActionForm>
  );
}

/** People page, under each person: set or reset their password. */
export function SetPasswordForm({ action, email, hasPassword }: { action: Action; email: string; hasPassword: boolean }) {
  return (
    <ActionForm action={action} className="flex flex-wrap items-center gap-2 pb-3">
      <input
        name="password"
        type="text"
        required
        minLength={PASSWORD_MIN_LENGTH}
        autoComplete="new-password"
        placeholder={hasPassword ? "New password" : "Set a password"}
        aria-label={`New password for ${email}`}
        className="input max-w-xs py-1.5"
      />
      <SubmitButton className="btn-secondary py-1.5">{hasPassword ? "Reset password" : "Set password"}</SubmitButton>
      {!hasPassword && <span className="text-xs text-amber-800">No password yet</span>}
    </ActionForm>
  );
}

/** Account page: change your own password. */
export function ChangePasswordForm({ action, hasPassword }: { action: Action; hasPassword: boolean }) {
  return (
    <ActionForm action={action} className="max-w-sm space-y-4">
      {hasPassword && (
        <Field label="Current password">
          <input name="current" type="password" required autoComplete="current-password" className="input" />
        </Field>
      )}
      <Field label="New password" hint={passwordHint}>
        <input name="password" type="password" required minLength={PASSWORD_MIN_LENGTH} autoComplete="new-password" className="input" />
      </Field>
      <Field label="New password again">
        <input name="confirm" type="password" required minLength={PASSWORD_MIN_LENGTH} autoComplete="new-password" className="input" />
      </Field>
      <SubmitButton>{hasPassword ? "Change password" : "Set password"}</SubmitButton>
    </ActionForm>
  );
}
