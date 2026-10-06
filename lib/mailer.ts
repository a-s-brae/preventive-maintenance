// Sending email through Resend's HTTP API (the same key as sign-in emails).
// Without AUTH_RESEND_KEY — e.g. in local mode — nothing is sent.

export const emailConfigured = () => !!process.env.AUTH_RESEND_KEY;

export async function sendEmail(msg: { to: string; subject: string; html: string; text: string }): Promise<{ sent: boolean; error?: string }> {
  const key = process.env.AUTH_RESEND_KEY;
  if (!key) return { sent: false, error: "Email isn't set up (no AUTH_RESEND_KEY)" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM ?? "PM System <onboarding@resend.dev>", ...msg }),
  });
  return res.ok ? { sent: true } : { sent: false, error: `Resend ${res.status}: ${(await res.text()).slice(0, 200)}` };
}
