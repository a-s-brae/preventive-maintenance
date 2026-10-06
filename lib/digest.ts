// The daily email: each person's overdue / due-soon work, and for admins a
// summary of what needs attention. buildDigest() is pure so it can be
// previewed and tested; sendDigests() gathers the data and sends.
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { emailConfigured, sendEmail } from "@/lib/mailer";
import { stockStatus } from "@/lib/parts";
import { getOpenWorkOrders } from "@/lib/queries";
import { woNumber } from "@/lib/work-orders";

export interface DigestItem {
  number: number;
  title: string;
  asset: string;
  due: string;
  overdue: boolean;
  url: string;
}

export interface DigestInput {
  name: string;
  role: Role;
  baseUrl: string;
  mine: DigestItem[];
  /** Admins only: the plant-wide picture. */
  summary?: { overdue: number; down: string[]; pendingRequests: number; lowStock: string[] };
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** The email for one person, or null if there's nothing worth sending. */
export function buildDigest(d: DigestInput): { subject: string; html: string; text: string } | null {
  const s = d.summary;
  const hasSummary = !!s && (s.overdue > 0 || s.down.length > 0 || s.pendingRequests > 0 || s.lowStock.length > 0);
  if (d.mine.length === 0 && !hasSummary) return null;

  const overdueMine = d.mine.filter((i) => i.overdue).length;
  const subject =
    d.mine.length > 0
      ? `${d.mine.length} work order${d.mine.length === 1 ? "" : "s"} need${d.mine.length === 1 ? "s" : ""} you${overdueMine ? ` (${overdueMine} overdue)` : ""}`
      : `Maintenance summary: ${[s!.overdue && `${s!.overdue} overdue`, s!.down.length && `${s!.down.length} down`, s!.pendingRequests && `${s!.pendingRequests} requests`].filter(Boolean).join(", ") || "low stock"}`;

  const text: string[] = [`Hi ${d.name},`, ""];
  const html: string[] = [`<p>Hi ${esc(d.name)},</p>`];
  if (d.mine.length) {
    text.push("Your work orders:");
    html.push("<p><strong>Your work orders</strong></p><ul>");
    for (const i of d.mine) {
      text.push(`- ${woNumber(i.number)} ${i.title} (${i.asset}) — ${i.overdue ? "OVERDUE, " : ""}due ${i.due}: ${i.url}`);
      html.push(
        `<li><a href="${esc(i.url)}">${woNumber(i.number)} ${esc(i.title)}</a> — ${esc(i.asset)} — ${i.overdue ? '<strong style="color:#b91c1c">overdue</strong>, ' : ""}due ${esc(i.due)}</li>`,
      );
    }
    html.push("</ul>");
    text.push("");
  }
  if (s && hasSummary) {
    text.push("Across the plant:");
    html.push("<p><strong>Across the plant</strong></p><ul>");
    const line = (t: string, h: string) => (text.push(`- ${t}`), html.push(`<li>${h}</li>`));
    if (s.overdue) line(`${s.overdue} overdue work orders`, `${s.overdue} overdue work orders`);
    if (s.down.length) line(`Down: ${s.down.join(", ")}`, `<strong style="color:#b91c1c">Down:</strong> ${esc(s.down.join(", "))}`);
    if (s.pendingRequests) line(`${s.pendingRequests} requests waiting for review`, `${s.pendingRequests} requests waiting for review`);
    if (s.lowStock.length) line(`Low on stock: ${s.lowStock.join(", ")}`, `Low on stock: ${esc(s.lowStock.join(", "))}`);
    html.push("</ul>");
    text.push("");
  }
  text.push(`Open the PM System: ${d.baseUrl}`, "", "You get this because daily emails are on for you in the PM System (People page).");
  html.push(
    `<p><a href="${esc(d.baseUrl)}">Open the PM System</a></p><p style="color:#64748b;font-size:12px">You get this because daily emails are on for you in the PM System (People page).</p>`,
  );
  return { subject, html: html.join("\n"), text: text.join("\n") };
}

/** Work due within this many days goes in the email. */
const SOON_DAYS = 2;

/** Everyone's digest input, for previewing and sending. */
export async function gatherDigests(baseUrl: string): Promise<{ email: string; input: DigestInput }[]> {
  const [users, open, down, pendingRequests, parts] = await Promise.all([
    db.user.findMany({ where: { active: true, emailDigest: true, role: { in: ["ADMIN", "TECH"] } } }),
    getOpenWorkOrders(),
    db.downtime.findMany({ where: { endedAt: null }, include: { asset: true } }),
    db.request.count({ where: { status: "PENDING" } }),
    db.part.findMany({ where: { active: true } }),
  ]);
  const summary = {
    overdue: open.filter((w) => w.due.status === "OVERDUE").length,
    down: down.map((d) => d.asset.name),
    pendingRequests,
    lowStock: parts.filter((p) => stockStatus(p) !== "OK").map((p) => p.name),
  };
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
  return users.map((u) => ({
    email: u.email,
    input: {
      name: u.name ?? u.email.split("@")[0],
      role: u.role,
      baseUrl,
      mine: open
        .filter((w) => w.assignedToId === u.id && (w.due.status === "OVERDUE" || (w.due.daysLeft != null && w.due.daysLeft <= SOON_DAYS)))
        .map((w) => ({
          number: w.number,
          title: w.title,
          asset: w.asset.name,
          due: w.dueDate ? fmt(w.dueDate) : w.dueMeter != null ? `at ${w.dueMeter} ${w.asset.meterUnit ?? ""}`.trim() : "—",
          overdue: w.due.status === "OVERDUE",
          url: `${baseUrl}/work-orders/${w.id}`,
        })),
      ...(u.role === "ADMIN" && { summary }),
    },
  }));
}

export async function sendDigests(baseUrl: string): Promise<{ sent: number; skipped: number; errors: string[] }> {
  if (!emailConfigured()) return { sent: 0, skipped: 0, errors: ["Email isn't set up (no AUTH_RESEND_KEY)"] };
  const result = { sent: 0, skipped: 0, errors: [] as string[] };
  for (const { email, input } of await gatherDigests(baseUrl)) {
    const msg = buildDigest(input);
    if (!msg) {
      result.skipped++;
      continue;
    }
    const r = await sendEmail({ to: email, ...msg });
    if (r.sent) result.sent++;
    else result.errors.push(`${email}: ${r.error}`);
  }
  return result;
}
