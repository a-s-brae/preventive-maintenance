import { currentUser } from "@/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";

/** Serve an attachment to signed-in staff. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user || user.active === false) return new Response("Sign in first", { status: 401 });
  if (!can(user.role, "view")) return new Response("Not allowed", { status: 403 });

  const { id } = await params;
  const a = await db.attachment.findUnique({ where: { id }, include: { data: true } });
  if (!a?.data) return new Response("Not found", { status: 404 });
  const download = new URL(req.url).searchParams.has("download");
  return new Response(new Uint8Array(a.data.bytes), {
    headers: {
      "Content-Type": a.mimeType,
      "Content-Length": String(a.data.bytes.length),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(a.fileName)}`,
      // Kept a few minutes only, so a deleted file or a deactivated person's
      // access stops working soon after.
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
      // An uploaded file opened on its own can't run anything as this site, or
      // be framed by another site. PDFs skip the sandbox: browsers won't show
      // them in one, and their viewer already runs apart from the page.
      "Content-Security-Policy":
        a.mimeType === "application/pdf" ? "frame-ancestors 'self'" : "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'self'",
    },
  });
}
