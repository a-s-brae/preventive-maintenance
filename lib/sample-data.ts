// Sample equipment with typical PM schedules, for trying the system out.
// Used by the "Load sample equipment" button and by `npm run db:seed`.
import type { Prisma } from "@prisma/client";
import type { ChecklistItem } from "@/lib/checklist";

const DAY = 86_400_000;
/** A date n days from today (negative = past), at 12:00 UTC like date inputs. */
function day(n: number): Date {
  const d = new Date(Date.now() + n * DAY);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12));
}
function firstOfNextMonth(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 12));
}

const check = (label: string): ChecklistItem => ({ label, type: "CHECK" });
const passFail = (label: string): ChecklistItem => ({ label, type: "PASS_FAIL" });
const number = (label: string, unit?: string): ChecklistItem => ({ label, type: "NUMBER", unit });
const text = (label: string): ChecklistItem => ({ label, type: "TEXT" });

/** Adds the sample assets. Does nothing if any assets already exist. */
export async function loadSampleData(tx: Prisma.TransactionClient): Promise<boolean> {
  if ((await tx.asset.count()) > 0) return false;

  const loc = async (name: string, parentId?: string) =>
    (await tx.location.findFirst({ where: { name, parentId: parentId ?? null } })) ?? (await tx.location.create({ data: { name, parentId } }));
  const plant = await loc("Main plant");
  const compressorRoom = await loc("Compressor room", plant.id);
  const warehouse = await loc("Warehouse", plant.id);
  const plantFloor = await loc("Plant floor", plant.id);
  const office = await loc("Office");

  const compressor = await tx.asset.create({
    data: {
      name: "Air Compressor #1",
      assetTag: "AC-001",
      category: "Compressed air",
      locationId: compressorRoom.id,
      meterUnit: "hours",
      currentMeter: 12_480,
      meterUpdatedAt: new Date(),
      tasks: {
        create: [
          {
            title: "Drain receiver tank & check for leaks",
            calendarEvery: 1,
            calendarUnit: "WEEK",
            startDate: day(-2),
            priority: "MEDIUM",
            checklist: [
              check("Drain condensate from receiver"),
              passFail("Auto-drain operating"),
              passFail("No leaks at fittings"),
              number("Tank pressure", "psi"),
            ],
          },
          {
            title: "Change oil & oil filter",
            calendarEvery: 12,
            calendarUnit: "MONTH",
            usageEvery: 2000,
            startDate: day(165),
            startMeter: 10_700,
            estimatedMinutes: 60,
            checklist: [check("Lock out / tag out"), check("Drain oil"), check("Replace oil filter"), check("Refill to level"), passFail("No leaks after run")],
          },
        ],
      },
    },
  });

  await tx.asset.create({
    data: {
      name: "Refrigerated Air Dryer",
      assetTag: "AD-001",
      category: "Compressed air",
      locationId: compressorRoom.id,
      parentId: compressor.id,
      tasks: {
        create: [
          {
            title: "Clean condenser & check dew point",
            calendarEvery: 3,
            calendarUnit: "MONTH",
            startDate: day(40),
            checklist: [check("Blow out condenser coil"), number("Dew point", "°F"), passFail("Drain trap working")],
          },
        ],
      },
    },
  });

  await tx.asset.create({
    data: {
      name: "Forklift — Toyota 8FGU25",
      assetTag: "FL-002",
      category: "Material handling",
      locationId: warehouse.id,
      meterUnit: "hours",
      currentMeter: 5_210,
      meterUpdatedAt: new Date(),
      tasks: {
        create: [
          {
            title: "Daily pre-shift inspection",
            calendarEvery: 1,
            calendarUnit: "DAY",
            dueSoonDays: 0,
            startDate: day(0),
            priority: "HIGH",
            checklist: [
              passFail("Tires & forks"),
              passFail("Horn, lights, backup alarm"),
              passFail("Brakes & parking brake"),
              passFail("No fluid leaks"),
              passFail("Seat belt"),
            ],
          },
          {
            title: "250-hour service",
            usageEvery: 250,
            startDate: day(0),
            startMeter: 4_990,
            checklist: [check("Engine oil & filter"), check("Grease fittings"), check("Check hydraulic fluid"), passFail("Chains & mast")],
          },
        ],
      },
    },
  });

  await tx.asset.create({
    data: {
      name: "Rooftop HVAC Unit — Office",
      assetTag: "HVAC-01",
      category: "HVAC",
      locationId: office.id,
      tasks: {
        create: [
          {
            title: "Replace air filters",
            calendarEvery: 3,
            calendarUnit: "MONTH",
            startDate: day(10),
            checklist: [check("Replace filters"), text("Filter size used"), passFail("Belt tension"), check("Clear condensate drain")],
          },
        ],
      },
    },
  });

  await tx.asset.create({
    data: {
      name: "Fire Extinguishers — Plant",
      category: "Safety",
      locationId: plantFloor.id,
      tasks: {
        create: [
          {
            title: "Monthly visual inspection",
            calendarEvery: 1,
            calendarUnit: "MONTH",
            scheduleBasis: "FIXED",
            startDate: firstOfNextMonth(),
            checklist: [passFail("Pressure gauge in green"), passFail("Pin & tamper seal intact"), passFail("Accessible & signed"), check("Initial inspection tag")],
          },
        ],
      },
    },
  });

  const dryer = await tx.asset.findFirstOrThrow({ where: { assetTag: "AD-001" } });
  await tx.request.create({
    data: {
      title: "Hissing air leak at the dryer inlet",
      description: "Loud hiss near the inlet fitting since this morning. Dryer is still running.",
      assetId: dryer.id,
      priority: "MEDIUM",
    },
  });

  return true;
}
