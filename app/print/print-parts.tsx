import { PrintButton } from "@/components/print-button";

export const ORG_NAME = process.env.ORG_NAME ?? "A.S. Plastech";

export function PrintHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-6 flex items-start justify-between gap-4 border-b-2 border-slate-900 pb-3">
      <div>
        <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{ORG_NAME} · Maintenance record</div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <div className="text-sm text-slate-600">{subtitle}</div>}
      </div>
      <div className="flex flex-col items-end gap-2 text-right text-xs text-slate-500">
        <PrintButton />
        <span>Printed {new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</span>
      </div>
    </header>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5 break-inside-avoid">
      <h2 className="mb-1.5 border-b border-slate-300 pb-0.5 text-sm font-bold tracking-wide uppercase">{title}</h2>
      {children}
    </section>
  );
}

export function Fields({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-1">
      {rows.map(([k, v]) => (
        <div key={k} className="flex gap-2">
          <dt className="w-36 shrink-0 text-slate-500">{k}</dt>
          <dd>{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
