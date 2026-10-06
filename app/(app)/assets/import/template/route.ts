import { requirePermission } from "@/auth";
import { csvResponse, toCsv } from "@/lib/csv";

export async function GET() {
  await requirePermission("manage");
  return csvResponse(
    "asset-import-template.csv",
    toCsv(
      ["Name", "Asset tag", "Category", "Location", "Parent asset", "Manufacturer", "Model", "Serial number", "Status", "Meter", "Meter unit", "Notes"],
      [
        ["Injection press 7", "PR-007", "Molding", "Main plant › Molding › Line 3", "", "Engel", "victory 120", "SN-12345", "active", "18250", "hours", ""],
        ["Press 7 mold chiller", "CH-007", "Utilities", "Main plant › Molding › Line 3", "PR-007", "Thermal Care", "", "", "active", "", "", ""],
      ],
    ),
  );
}
