// Loads sample equipment into an empty database: npm run db:seed
import { PrismaClient } from "@prisma/client";
import { loadSampleData } from "../lib/sample-data";

const db = new PrismaClient();

db.$transaction((tx) => loadSampleData(tx))
  .then((loaded) => console.log(loaded ? "Loaded sample equipment." : "Assets already exist — skipping sample data."))
  .finally(() => db.$disconnect());
