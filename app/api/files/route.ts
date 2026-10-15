import { currentUser } from "@/auth";
import { db } from "@/lib/db";
import { ALLOWED_TYPES, MAX_BYTES } from "@/lib/files";
import { can } from "@/lib/permissions";

/** Upload a photo or PDF to a work order or an asset. */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user || user.active === false) return Response.json({ error: "Sign in first" }, { status: 401 });
  if (!can(user.role, "work")) return Response.json({ error: "Not allowed" }, { status: 403 });

  const form = await req.formData().catch(() => null);
  if (!form) return Response.json({ error: "Send the file as a form upload" }, { status: 400 });
  const file = form.get("file");
  const workOrderId = String(form.get("workOrderId") ?? "") || null;
  const assetId = String(form.get("assetId") ?? "") || null;
  if (!(file instanceof File)) return Response.json({ error: "No file" }, { status: 400 });
  if (!workOrderId === !assetId) return Response.json({ error: "Attach it to a work order or an asset" }, { status: 400 });
  if (!(ALLOWED_TYPES as readonly string[]).includes(file.type)) {
    return Response.json({ error: "Only photos (JPEG, PNG, WebP, GIF) and PDFs can be attached" }, { status: 415 });
  }
  if (file.size > MAX_BYTES) return Response.json({ error: "Files can be up to 10 MB" }, { status: 413 });

  const exists = workOrderId ? await db.workOrder.count({ where: { id: workOrderId } }) : await db.asset.count({ where: { id: assetId! } });
  if (!exists) return Response.json({ error: "Not found" }, { status: 404 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const attachment = await db.attachment.create({
    data: {
      workOrderId,
      assetId,
      fileName: (file.name || "file").slice(0, 200),
      mimeType: file.type,
      size: bytes.length,
      uploadedById: user.id,
      data: { create: { bytes } },
    },
    select: { id: true },
  });
  return Response.json({ id: attachment.id });
}
