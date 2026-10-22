import { requirePermission } from "@/auth";

/** Printable records: no menu, letter-size friendly. */
export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  await requirePermission("view");
  return <div className="mx-auto max-w-4xl bg-white px-6 py-8 text-[13px] text-neutral-900 print:max-w-none print:p-0">{children}</div>;
}
