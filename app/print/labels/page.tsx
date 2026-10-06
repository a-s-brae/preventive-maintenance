import { headers } from "next/headers";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { getLocationTree } from "@/lib/queries";
import { descendantIds, pathLabel } from "@/lib/tree";
import { PrintButton } from "@/components/print-button";
import { ORG_NAME } from "../print-parts";

export const dynamic = "force-dynamic";

/** The address phones will open: APP_URL when set, else the one this page was opened on. */
async function baseUrl(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, "");
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
}

/** QR labels for equipment, 2" × 4" (Avery 5163 / 8163 size), ten to a letter sheet.
 *  ?asset=<id> (repeatable) for chosen assets, ?location=<id> for everything in a
 *  location, nothing for all equipment in service. */
export default async function LabelsPage({ searchParams }: { searchParams: Promise<{ asset?: string | string[]; location?: string }> }) {
  const params = await searchParams;
  const ids = [params.asset ?? []].flat();
  const locations = await getLocationTree();
  const where = ids.length
    ? { id: { in: ids } }
    : params.location
      ? { locationId: { in: [...descendantIds(locations, params.location)] }, status: { not: "RETIRED" as const } }
      : { status: { not: "RETIRED" as const } };
  const assets = await db.asset.findMany({ where, orderBy: [{ assetTag: "asc" }, { name: "asc" }], select: { id: true, name: true, assetTag: true, locationId: true } });

  const base = await baseUrl();
  const host = new URL(base).hostname;
  const unreachable = host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
  const labels = await Promise.all(
    assets.map(async (a) => {
      const url = `${base}/a/${a.id}`;
      const svg = await QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M" });
      return { ...a, url, svg, location: pathLabel(locations.find((l) => l.id === a.locationId)) };
    }),
  );

  return (
    <>
      <style>{`@page { size: letter; margin: 0.5in 0.15in; }`}</style>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold">Equipment QR labels</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-600">
            {labels.length} {labels.length === 1 ? "label" : "labels"}, 2″ × 4″ — prints ten to a sheet on Avery 5163 / 8163, or on plain paper to
            cut out and laminate. Print at 100% (actual size). Scanning a label opens the asset for maintenance staff, and “Report a problem” for
            everyone else.
          </p>
        </div>
        <PrintButton />
      </header>
      {unreachable && (
        <p className="mb-5 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200 print:hidden">
          These codes point to <strong>{base}</strong>, which phones can’t open. Open this page using the network address shown when you start
          the app (for example http://192.168.1.20:3000), or print the labels once the app is online.
        </p>
      )}
      {labels.length === 0 ? (
        <p className="text-sm text-slate-500">No equipment to label.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,4in)] justify-center gap-x-[0.19in] print:gap-y-0">
          {labels.map((l) => (
            <div key={l.id} className="flex h-[2in] w-[4in] break-inside-avoid items-center gap-3 overflow-hidden rounded-md border border-dashed border-slate-300 p-[0.15in] print:rounded-none print:border-transparent">
              <div className="size-[1.6in] shrink-0 [&_svg]:size-full" role="img" aria-label={`QR code for ${l.name}`} dangerouslySetInnerHTML={{ __html: l.svg }} />
              <div className="flex min-w-0 flex-1 flex-col self-stretch">
                <div className="text-[8pt] font-semibold tracking-wide text-slate-500 uppercase">{ORG_NAME} maintenance</div>
                <div className="mt-1 line-clamp-3 text-[13pt] leading-tight font-bold">{l.name}</div>
                {l.assetTag && <div className="mt-1 font-mono text-[11pt]">{l.assetTag}</div>}
                {l.location && <div className="mt-0.5 line-clamp-2 text-[8pt] text-slate-600">{l.location}</div>}
                <div className="mt-auto text-[7.5pt] leading-snug text-slate-700">Scan to report a problem or see its maintenance history</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
