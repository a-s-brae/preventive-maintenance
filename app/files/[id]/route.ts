import { auth, type SessionUser } from "@/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";

/** Serve an attachment to signed-in staff. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const user = session?.user as SessionUser | undefined;
  if (!user?.id) return new Response("Sign in first", { status: 401 });
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
      "Cache-Control": "private, max-age=86400, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
