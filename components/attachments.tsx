import type { Attachment, User } from "@prisma/client";
import { deleteAttachment } from "@/lib/actions";
import { formatDate } from "@/lib/forms";
import { formatBytes, isImage } from "@/lib/files";
import { userLabel } from "@/lib/queries";
import { ConfirmButton } from "./form";
import { Empty } from "./ui";
import { UploadButton } from "./upload-button";

type Row = Attachment & { uploadedBy: User | null };

/** Photos as thumbnails, PDFs as a list, with upload and delete. */
export function Attachments({
  attachments,
  target,
  canUpload,
  canDelete,
  emptyText = "No photos or files yet.",
}: {
  attachments: Row[];
  target: { workOrderId: string } | { assetId: string };
  canUpload: boolean;
  /** Whether this person may delete a given file. */
  canDelete: (a: Row) => boolean;
  /** Shown when there are none; null shows nothing (the upload button says it all). */
  emptyText?: string | null;
}) {
  const photos = attachments.filter((a) => isImage(a.mimeType));
  const docs = attachments.filter((a) => !isImage(a.mimeType));
  return (
    <div className="space-y-4">
      {attachments.length === 0 && emptyText && <Empty>{emptyText}</Empty>}
      {photos.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((a) => (
            <li key={a.id} className="group relative overflow-hidden rounded-md border border-slate-200 bg-slate-50">
              <a href={`/files/${a.id}`} target="_blank" rel="noreferrer" title={a.fileName}>
                {/* eslint-disable-next-line @next/next/no-img-element -- served by our own auth-checked route */}
                <img src={`/files/${a.id}`} alt={a.fileName} loading="lazy" className="aspect-square w-full object-cover" />
              </a>
              <div className="flex items-center justify-between gap-1 px-2 py-1 text-xs text-slate-500">
                <span className="truncate">
                  {formatDate(a.createdAt)} · {userLabel(a.uploadedBy)}
                </span>
                {canDelete(a) && (
                  <ConfirmButton action={deleteAttachment.bind(null, a.id)} message="Delete this photo?" className="text-red-700 hover:underline">
                    Delete
                  </ConfirmButton>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {docs.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-md border border-slate-200 text-sm">
          {docs.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <a href={`/files/${a.id}`} target="_blank" rel="noreferrer" className="link truncate">
                📄 {a.fileName}
              </a>
              <span className="flex shrink-0 items-center gap-3 text-xs text-slate-500">
                {formatBytes(a.size)} · {formatDate(a.createdAt)}
                {canDelete(a) && (
                  <ConfirmButton action={deleteAttachment.bind(null, a.id)} message="Delete this file?" className="text-red-700 hover:underline">
                    Delete
                  </ConfirmButton>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {canUpload && <UploadButton target={target} />}
    </div>
  );
}
