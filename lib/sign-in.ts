// Where sign-in sends people: back to the page they asked for, on this site only.

/** A path on this site to go to after signing in; anything else goes home. */
export function safeNext(v: unknown): string {
  // No control characters or backslashes anywhere: browsers drop tabs and
  // newlines from URLs, so "/\t/evil.example" would become "//evil.example".
  return typeof v === "string" && /^\/(?![/\\])/.test(v) && !/[\x00-\x1f\x7f\\]/.test(v) && !v.startsWith("/login") ? v : "/";
}

/** The sign-in page, coming back to `path` afterwards. */
export function loginHref(path: string | null | undefined): string {
  const next = safeNext(path);
  return next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`;
}
