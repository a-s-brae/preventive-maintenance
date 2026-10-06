import Link from "next/link";
import type { Part, PartUsage, User } from "@prisma/client";
import { removePartUsage, usePart } from "@/lib/actions";
import { formatMoney, formatQty, partsCost } from "@/lib/parts";
import { userLabel } from "@/lib/queries";
import { ConfirmButton } from "./form";
import { UsePartForm } from "./part-forms";
import { Empty } from "./ui";

type Usage = PartUsage & { part: Part; usedBy: User | null };

export function WorkOrderParts({
  workOrderId,
  usages,
  parts,
  canEdit,
}: {
  workOrderId: string;
  usages: Usage[];
  parts: Pick<Part, "id" | "name" | "partNumber" | "quantity" | "unit">[];
  canEdit: boolean;
}) {
  return (
    <div className="space-y-4">
      {usages.length === 0 ? (
        <Empty>No parts used yet.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Part</th>
                <th>Qty</th>
                <th>Unit cost</th>
                <th>Cost</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {usages.map((u) => (
                <tr key={u.id}>
                  <td>
                    <Link href={`/parts/${u.part.id}`} className="link">
                      {u.part.name}
                    </Link>
                    <div className="text-xs text-slate-500">
                      {[u.part.partNumber, userLabel(u.usedBy)].filter(Boolean).join(" · ")}
                    </div>
                  </td>
                  <td className="tabular-nums">
                    {formatQty(u.quantity)} {u.part.unit}
                  </td>
                  <td className="tabular-nums text-slate-600">{formatMoney(u.unitCost)}</td>
                  <td className="tabular-nums">{u.unitCost == null ? "—" : formatMoney(u.quantity * u.unitCost)}</td>
                  <td className="text-right">
                    {canEdit && (
                      <ConfirmButton action={removePartUsage.bind(null, u.id)} message="Remove this line and put the parts back in stock?" className="text-xs text-red-700 hover:underline">
                        Remove
                      </ConfirmButton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="text-right text-xs font-medium tracking-wide text-slate-500 uppercase">
                  Parts total
                </td>
                <td className="font-medium tabular-nums">{formatMoney(partsCost(usages))}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {canEdit && <UsePartForm action={usePart.bind(null, workOrderId)} parts={parts} />}
    </div>
  );
}
