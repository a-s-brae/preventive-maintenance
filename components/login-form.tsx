"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { FormError } from "./form";

export type LoginState = { error?: string; link?: string } | undefined;

type Action = (prev: LoginState, fd: FormData) => Promise<LoginState>;

/** Sends the form without React clearing it, so a mistake doesn't wipe what was typed. */
function useLoginAction(action: Action) {
  const [state, dispatch, pending] = useActionState(action, undefined);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => dispatch(fd));
  };
  return { state, pending, onSubmit };
}

const label = "mb-1.5 block text-sm font-medium text-ink";

/** Sign in by email link (or straight in, in local mode). */
export function LoginForm({ action, localMode, next = "/" }: { action: Action; localMode: boolean; /** Page to return to after signing in. */ next?: string }) {
  const { state, pending, onSubmit } = useLoginAction(action);

  // Local mode: open the sign-in link directly instead of emailing it.
  useEffect(() => {
    if (state?.link) window.location.assign(state.link);
  }, [state?.link]);

  const busy = pending || !!state?.link;
  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <FormError error={state?.error} />
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className={label}>Work email</span>
        <input name="email" type="email" required autoComplete="email" placeholder="you@as-plastech.com" className="input py-2.5" />
      </label>
      <button type="submit" disabled={busy} className="btn-primary w-full py-2.5">
        {busy ? "Signing in…" : localMode ? "Sign in" : "Email me a sign-in link"}
      </button>
    </form>
  );
}

/** Sign in with your work email and your password. */
export function PasswordForm({ action, next = "/" }: { action: Action; next?: string }) {
  const { state, pending, onSubmit } = useLoginAction(action);
  const [show, setShow] = useState(false);
  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <FormError error={state?.error} />
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className={label}>Work email</span>
        <input name="email" type="email" required autoComplete="username" autoFocus placeholder="you@as-plastech.com" className="input py-2.5" />
      </label>
      <div>
        <label htmlFor="password" className={label}>
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={show ? "text" : "password"}
            required
            autoComplete="current-password"
            className="input py-2.5 pr-16"
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            aria-pressed={show}
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute inset-y-1 right-1 rounded-md px-2.5 text-xs text-neutral-500 hover:bg-neutral-100 hover:text-ink"
          >
            {show ? "Hide" : "Show"}
          </button>
        </div>
      </div>
      <button type="submit" disabled={pending} className="btn-primary w-full py-2.5">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
