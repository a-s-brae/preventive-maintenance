// Team password sign-in: while TEAM_PASSWORD is set, people sign in with their
// work email and one shared password, typed into the browser's own sign-in box
// (HTTP Basic authentication), instead of using an emailed link. A stopgap for
// when sign-in email isn't working: remove TEAM_PASSWORD to go back to email.
//
// Anyone who knows the password can sign in as any company address, so keep
// it to the team. proxy.ts asks for it on every page; auth.ts works out who
// the person is from the same email and password.

export const TEAM_PASSWORD_MIN_LENGTH = 12;

/** The team password, or null when sign-in is by email link. */
export function teamPassword(env: Record<string, string | undefined> = process.env): string | null {
  return env.TEAM_PASSWORD || null;
}

/** The email and password from an `Authorization: Basic …` header. */
export function parseBasicAuth(header: string | null | undefined): { email: string; password: string } | null {
  const encoded = header?.match(/^Basic\s+([A-Za-z0-9+/]+=*)\s*$/i)?.[1];
  if (!encoded) return null;
  let decoded: string;
  try {
    decoded = new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
  const colon = decoded.indexOf(":");
  if (colon < 0) return null;
  const email = decoded.slice(0, colon).trim().toLowerCase();
  return email ? { email, password: decoded.slice(colon + 1) } : null;
}

/** Compare passwords in constant time: how long it takes says nothing about how much matched. */
export function passwordMatches(given: string, expected: string): boolean {
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}
