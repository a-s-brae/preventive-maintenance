import { requirePermission } from "@/auth";
import { csvResponse, toCsv } from "@/lib/csv";

export async function GET() {
  await requirePermission("manage");
  return csvResponse(
    "part-import-template.csv",
    toCsv(
      ["Name", "Part number", "On hand", "Unit", "Low-stock level", "Unit cost", "Stored at", "Vendor", "Active"],
      [
        ["V-belt B42", "VB-42", "4", "ea", "2", "12.50", "Crib B, bin 3", "Grainger", "yes"],
        ["Hydraulic oil AW46", "AW46-5G", "3", "pail", "1", "89", "Oil room", "", "yes"],
      ],
    ),
  );
}
