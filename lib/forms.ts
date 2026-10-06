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
  locationId: optText,
  parentId: optText,
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
  assetDown: z.preprocess((v) => v === "on", z.boolean()),
});

export const locationSchema = z.object({
  name: reqText,
  parentId: optText,
  notes: optText,
});

/** Reporting a problem. Asset and location are both optional — the reviewer can fill them in. */
export const requestSchema = z.object({
  title: reqText,
  description: optText,
  assetId: optText,
  locationId: optText,
  priority,
  assetDown: z.preprocess((v) => v === "on", z.boolean()),
});

export const approveSchema = z.object({
  assetId: z.string().min(1, "Pick the asset this work is on"),
  priority,
  dueDate: optDate,
  assignedToId: optText,
  note: optText,
});

export const rejectSchema = z.object({
  note: z.string().trim().min(1, "Say why it's rejected, so the requester knows").max(2000),
});

export const downSchema = z.object({ reason: optText });

export const completeSchema = z.object({
  performedAt: dateOnly,
  meterReading: optNumber,
  notes: optText,
  assetUp: z.preprocess((v) => v === "on", z.boolean()),
});

const positive = z.coerce.number({ message: "Enter a number" }).positive("Must be more than 0");

export const partSchema = z.object({
  name: reqText,
  partNumber: optText,
  description: optText,
  unit: z.preprocess(blankToUndef, z.string().trim().max(20).default("ea")),
  minQuantity: optNumber,
  unitCost: optNumber,
  storageLocation: optText,
  vendor: optText,
  notes: optText,
  /** Only used when creating: stock on hand to start with. */
  quantity: optNumber,
  active: z.preprocess((v) => v === undefined || v === "on" || v === "true", z.boolean()),
});

export const restockSchema = z.object({ quantity: positive, unitCost: optNumber, note: optText });
export const countSchema = z.object({ counted: z.coerce.number({ message: "Enter the count" }).nonnegative(), note: optText });
export const usePartSchema = z.object({ partId: z.string().min(1, "Pick a part"), quantity: positive });

export const laborSchema = z
  .object({
    hours: z.preprocess(blankToUndef, z.coerce.number().int().min(0).max(24).optional()),
    minutes: z.preprocess(blankToUndef, z.coerce.number().int().min(0).max(59).optional()),
    date: dateOnly,
    note: optText,
  })
  .refine((l) => (l.hours ?? 0) * 60 + (l.minutes ?? 0) > 0, { message: "Enter the time spent", path: ["minutes"] })
  .transform((l) => ({ ...l, total: (l.hours ?? 0) * 60 + (l.minutes ?? 0) }));
