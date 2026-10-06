import { requirePermission } from "@/auth";
import { previewImport, runImport } from "@/lib/actions";
import { ImportForm } from "@/components/import-form";
import { Card, PageHeader } from "@/components/ui";

export default async function ImportPartsPage() {
  await requirePermission("manage");
  return (
    <>
      <PageHeader title="Import parts" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <ImportForm kind="parts" preview={previewImport} run={runImport} listHref="/parts" />
          </Card>
        </div>
        <Card title="How it works">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700">
            <li>
              Start from the <a href="/parts/import/template" className="link">template</a>, or <a href="/parts/export" className="link">export your parts</a> and edit
              that file in Excel.
            </li>
            <li>
              One row per part. Only <strong>Name</strong> is required. Other columns: Part number, On hand, Unit, Low-stock level, Unit cost, Stored
              at, Vendor, Active.
            </li>
            <li>
              Rows whose <strong>part number</strong> (or, without numbers, name) matches an existing part update it; the rest are added.
            </li>
            <li>
              <strong>On hand</strong> sets the stock count. A change is recorded in the part’s stock history as a count from the import.
            </li>
            <li>Save as CSV, pick it here and check the preview. Nothing changes until you click Import.</li>
          </ol>
        </Card>
      </div>
    </>
  );
}
