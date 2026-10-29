// Team password sign-in: while TEAM_PASSWORD is set, people sign in on the
// sign-in page with their work email and one shared password, instead of an
// emailed link. A stopgap for when sign-in email isn't working: remove
// TEAM_PASSWORD to go back to email.
//
// Anyone who knows the password can sign in as any company address, so keep
// it to the team. auth.ts checks it and starts the session.

export const TEAM_PASSWORD_MIN_LENGTH = 12;

/** The team password, or null when sign-in is by email link. */
export function teamPassword(env: Record<string, string | undefined> = process.env): string | null {
  return env.TEAM_PASSWORD || null;
}

/** Compare passwords in constant time: how long it takes says nothing about how much matched. */
export function passwordMatches(given: string, expected: string): boolean {
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}
