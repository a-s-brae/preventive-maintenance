// Sample equipment with typical PM tasks, for trying the system out.
// Used by the "Load sample equipment" button and by `npm run db:seed`.
import type { Prisma } from "@prisma/client";

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

/** Adds the sample assets. Does nothing if any assets already exist. */
export async function loadSampleData(tx: Prisma.TransactionClient): Promise<boolean> {
  if ((await tx.asset.count()) > 0) return false;

  await tx.asset.create({
    data: {
      name: "Air Compressor #1",
      assetTag: "AC-001",
      category: "Compressed air",
      location: "Compressor room",
      meterUnit: "hours",
      currentMeter: 12_480,
      meterUpdatedAt: new Date(),
      tasks: {
        create: [
          {
            title: "Drain receiver tank & check for leaks",
            calendarEvery: 1,
            calendarUnit: "WEEK",
            startDate: daysAgo(9),
            checklist: ["Drain condensate from receiver", "Check auto-drain operation", "Listen for leaks at fittings"],
          },
          {
            title: "Change oil & oil filter",
            calendarEvery: 12,
            calendarUnit: "MONTH",
            usageEvery: 2000,
            startDate: daysAgo(200),
            startMeter: 10_700,
            estimatedMinutes: 60,
            checklist: ["Lock out / tag out", "Drain oil", "Replace oil filter", "Refill to level", "Run and check for leaks"],
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
      location: "Warehouse",
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
            startDate: daysAgo(1),
            checklist: ["Tires & forks", "Horn, lights, backup alarm", "Brakes & parking brake", "Fluid leaks", "Seat belt"],
          },
          {
            title: "250-hour service",
            usageEvery: 250,
            startDate: daysAgo(30),
            startMeter: 4_990,
            checklist: ["Engine oil & filter", "Grease fittings", "Check hydraulic fluid", "Inspect chains & mast"],
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
      location: "Roof, office side",
      tasks: {
        create: [
          {
            title: "Replace air filters",
            calendarEvery: 3,
            calendarUnit: "MONTH",
            startDate: daysAgo(80),
            checklist: ["Replace filters (size on unit label)", "Check belt tension", "Clear condensate drain"],
          },
        ],
      },
    },
  });

  await tx.asset.create({
    data: {
      name: "Fire Extinguishers — Plant",
      category: "Safety",
      location: "Plant floor",
      tasks: {
        create: [
          {
            title: "Monthly visual inspection",
            calendarEvery: 1,
            calendarUnit: "MONTH",
            startDate: daysAgo(20),
            checklist: ["Pressure gauge in green", "Pin & tamper seal intact", "Accessible & signed", "Initial inspection tag"],
          },
        ],
      },
    },
  });

  return true;
}
