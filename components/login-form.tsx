"use client";

import { startTransition, useActionState, useEffect } from "react";
import { FormError } from "./form";

export type LoginState = { error?: string; link?: string } | undefined;

export function LoginForm({
  action,
  localMode,
}: {
  action: (prev: LoginState, fd: FormData) => Promise<LoginState>;
  localMode: boolean;
}) {
  const [state, dispatch, pending] = useActionState(action, undefined);

  // Local mode: open the sign-in link directly instead of emailing it.
  useEffect(() => {
    if (state?.link) window.location.assign(state.link);
  }, [state?.link]);

  const busy = pending || !!state?.link;
  return (
    <form
      className="mt-4 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => dispatch(fd));
      }}
    >
      <FormError error={state?.error} />
      <input name="email" type="email" required autoComplete="email" placeholder="you@as-plastech.com" className="input" />
      <button type="submit" disabled={busy} className="btn-primary w-full">
        {busy ? "Signing in…" : localMode ? "Sign in" : "Email me a sign-in link"}
      </button>
    </form>
  );
}
