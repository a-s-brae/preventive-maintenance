import { requirePermission } from "@/auth";
import { previewImport, runImport } from "@/lib/actions";
import { ImportForm } from "@/components/import-form";
import { Card, PageHeader } from "@/components/ui";

export default async function ImportAssetsPage() {
  await requirePermission("manage");
  return (
    <>
      <PageHeader title="Import assets" />
      <div className="grid gap-6 @4xl:grid-cols-3">
        <div className="@4xl:col-span-2">
          <Card>
            <ImportForm kind="assets" preview={previewImport} run={runImport} listHref="/assets" />
          </Card>
        </div>
        <Card title="How it works">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-neutral-700">
            <li>
              Start from the <a href="/assets/import/template" className="link">template</a>, or <a href="/assets/export" className="link">export your assets</a> and edit
              that file in Excel.
            </li>
            <li>
              One row per asset. Only <strong>Name</strong> is required. Other columns: Asset tag, Category, Location, Parent asset, Manufacturer,
              Model, Serial number, Status, Meter, Meter unit, Notes.
            </li>
            <li>
              <strong>Location</strong> is a path like <code>Main plant › Molding › Line 3</code> (“&gt;” or “/” work too). Missing locations are
              created.
            </li>
            <li>
              Rows whose <strong>asset tag</strong> (or, without tags, name) matches an existing asset update it; the rest are added.
              <strong> Parent asset</strong> is another asset’s tag or name, in the system or in the same file.
            </li>
            <li>Save as CSV, pick it here and check the preview. Nothing changes until you click Import.</li>
          </ol>
        </Card>
      </div>
    </>
  );
}
