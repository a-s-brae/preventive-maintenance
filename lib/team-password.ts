// Team password: being phased out in favour of each person's own password
// (lib/passwords.ts). While TEAM_PASSWORD is still set, it only opens accounts
// that don't have their own password yet (auth.ts signInWithPassword), so
// everyone can get in once to set one. Remove TEAM_PASSWORD once they have.

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
