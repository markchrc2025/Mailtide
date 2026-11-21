import { simpleParser } from "mailparser";
import { authed, fail } from "@/lib/http";
import { withFolder } from "@/lib/imap";

export const dynamic = "force-dynamic";

const SAFE_INLINE = /^(image\/(png|jpe?g|gif|webp)|application\/pdf|text\/plain)$/i;

export const GET = authed(async (user, req: Request, ctx: { params: Promise<{ uid: string; idx: string }> }) => {
  const { uid, idx } = await ctx.params;
  const n = Number(uid);
  const i = Number(idx);
  if (!Number.isInteger(n) || !Number.isInteger(i) || i < 0) return fail("Bad attachment id.");
  const folder = new URL(req.url).searchParams.get("folder") || "INBOX";
  const download = new URL(req.url).searchParams.get("download") === "1";

  const att = await withFolder(user, folder, async (c) => {
    const m = await c.fetchOne(String(n), { source: true }, { uid: true });
    if (!m || !m.source) return null;
    const p = await simpleParser(m.source);
    return p.attachments[i] ?? null;
  });
  if (!att) return fail("Attachment not found.", 404);

  const type = att.contentType || "application/octet-stream";
  const inline = !download && SAFE_INLINE.test(type);
  const name = (att.filename || `attachment-${i + 1}`).replace(/["\r\n]/g, "");
  return new Response(new Uint8Array(att.content), {
    headers: {
      "Content-Type": inline ? type : "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
