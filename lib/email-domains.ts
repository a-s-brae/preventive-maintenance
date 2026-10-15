// Who may sign in: company email addresses only (ALLOWED_EMAIL_DOMAINS).
// Plain module so proxy.ts can use it without loading the sign-in setup.

const allowedDomains = (process.env.ALLOWED_EMAIL_DOMAINS ?? "as-plastech.com")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export function isAllowedEmail(email: string | null | undefined): boolean {
  const domain = email?.toLowerCase().split("@")[1];
  return !!domain && allowedDomains.includes(domain);
}
