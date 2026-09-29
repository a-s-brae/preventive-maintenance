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

const priority = z.enum(["NONE", "LOW", "MEDIUM", "HIGH"]).default("NONE");
const optDate = z.preprocess(blankToUndef, dateOnly.optional());

/** PM schedule. The checklist comes from the checklist editor, parsed separately. */
export const taskSchema = z
  .object({
    title: reqText,
    instructions: optText,
    calendarEvery: optInt,
    calendarUnit: z.preprocess(blankToUndef, z.enum(["DAY", "WEEK", "MONTH", "YEAR"]).optional()),
    usageEvery: z.preprocess(blankToUndef, z.coerce.number().positive().optional()),
    scheduleBasis: z.enum(["COMPLETION", "FIXED"]).default("COMPLETION"),
    startDate: dateOnly,
    startMeter: optNumber,
    dueSoonDays: z.coerce.number().int().min(0).max(365).default(7),
    estimatedMinutes: optInt,
    priority,
    defaultAssigneeId: optText,
    active: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  })
  .refine((t) => (t.calendarEvery == null) === (t.calendarUnit == null), {
    message: "Set both the calendar interval and its unit, or neither",
    path: ["calendarEvery"],
  })
  .refine((t) => t.calendarEvery != null || t.usageEvery != null, {
    message: "Set a calendar interval, a usage interval, or both",
    path: ["calendarEvery"],
  });

/** Creating or editing a work order by hand. */
export const workOrderSchema = z.object({
  type: z.enum(["REPAIR", "INSPECTION"]).default("REPAIR"),
  title: reqText,
  description: optText,
  assetId: z.string().min(1, "Pick an asset"),
  priority,
  dueDate: optDate,
  assignedToId: optText,
});

export const completeSchema = z.object({
  performedAt: dateOnly,
  meterReading: optNumber,
  notes: optText,
});
