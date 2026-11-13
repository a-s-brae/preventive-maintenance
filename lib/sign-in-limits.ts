// Limits on wrong passwords, so they can't be guessed: after too many misses
// for one email, or from one address, sign-in waits a while. Misses are kept in
// the database (SignInFailure) so every server instance sees the same count.

export const WINDOW_MINUTES = 15;
/** Wrong passwords for one email before it waits. */
export const EMAIL_LIMIT = 5;
/** Wrong passwords from one network address, across all emails, before it waits. */
export const IP_LIMIT = 30;

export const emailKey = (email: string) => `email:${email}`;
export const ipKey = (ip: string) => `ip:${ip}`;

export function isLimited(misses: { email: number; ip: number }): boolean {
  return misses.email >= EMAIL_LIMIT || misses.ip >= IP_LIMIT;
}

/** The visitor's address. On Vercel the platform sets these headers itself. */
export function clientIp(h: Headers): string {
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}
