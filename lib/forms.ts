import { z } from "zod";

export type FormState = { error?: string } | undefined;

// FormData gives "" for empty inputs; treat that as "not provided".
const blankToUndef = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

export const optText = z.preprocess(blankToUndef, z.string().trim().max(2000).optional());
export const reqText = z.string().trim().min(1, "Required").max(200);
export const optNumber = z.preprocess(blankToUndef, z.coerce.number().nonnegative().optional());
export const optInt = z.preprocess(blankToUndef, z.coerce.number().int().positive().optional());

/** Date-only input ("YYYY-MM-DD"), stored at 12:00 UTC so it shows as the same
 *  calendar day in any US time zone. */
export const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date")
  .transform((s) => new Date(`${s}T12:00:00Z`));

export function toDateInput(d: Date | null | undefined): string {
  return (d ?? new Date()).toISOString().slice(0, 10);
}

export function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-US", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" });
}

export function formatNumber(n: number | null | undefined): string {
  return n == null ? "—" : n.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

export function firstError(err: z.ZodError): string {
  const issue = err.issues[0];
  const field = issue?.path.join(".");
  return field ? `${field}: ${issue.message}` : (issue?.message ?? "Invalid input");
}

export const assetSchema = z.object({
  name: reqText,
  assetTag: optText,
  category: optText,
  location: optText,
  manufacturer: optText,
  model: optText,
  serialNumber: optText,
  status: z.enum(["ACTIVE", "INACTIVE", "RETIRED"]).default("ACTIVE"),
  meterUnit: optText,
  notes: optText,
});

export const taskSchema = z
  .object({
    title: reqText,
    instructions: optText,
    checklist: z.string().default(""),
    calendarEvery: optInt,
    calendarUnit: z.preprocess(blankToUndef, z.enum(["DAY", "WEEK", "MONTH", "YEAR"]).optional()),
    usageEvery: z.preprocess(blankToUndef, z.coerce.number().positive().optional()),
    startDate: dateOnly,
    startMeter: optNumber,
    dueSoonDays: z.coerce.number().int().min(0).max(365).default(7),
    estimatedMinutes: optInt,
    active: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  })
  .refine((t) => (t.calendarEvery == null) === (t.calendarUnit == null), {
    message: "Set both the calendar interval and its unit, or neither",
    path: ["calendarEvery"],
  })
  .refine((t) => t.calendarEvery != null || t.usageEvery != null, {
    message: "Set a calendar interval, a usage interval, or both",
    path: ["calendarEvery"],
  })
  .transform((t) => ({
    ...t,
    checklist: t.checklist
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
  }));

export const logSchema = z.object({
  kind: z.enum(["PM", "REPAIR", "INSPECTION"]).default("PM"),
  performedAt: dateOnly,
  meterReading: optNumber,
  notes: optText,
});
