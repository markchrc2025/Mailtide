import { simpleParser, type AddressObject } from "mailparser";
import { authed, fail, json } from "@/lib/http";
import { withFolder } from "@/lib/imap";
import { cleanHtml, textToHtml } from "@/lib/mail";

export const dynamic = "force-dynamic";

function list(a?: AddressObject | AddressObject[]) {
  const arr = Array.isArray(a) ? a : a ? [a] : [];
  return arr.flatMap((x) => x.value.map((v) => ({ name: v.name || "", address: v.address || "" })));
}

export const GET = authed(async (user, req: Request, ctx: { params: Promise<{ uid: string }> }) => {
  const { uid } = await ctx.params;
  const n = Number(uid);
  if (!Number.isInteger(n) || n <= 0) return fail("Bad message id.");
  const url = new URL(req.url);
  const folder = url.searchParams.get("folder") || "INBOX";

  const out = await withFolder(user, folder, async (c) => {
    const m = await c.fetchOne(String(n), { uid: true, flags: true, source: true }, { uid: true });
    if (!m || !m.source) return null;
    if (!m.flags?.has("\\Seen")) await c.messageFlagsAdd(String(n), ["\\Seen"], { uid: true });
    const p = await simpleParser(m.source);
    const base = `/api/messages/${n}/attachments`;
    const q = `?folder=${encodeURIComponent(folder)}`;
    const attachments = p.attachments.map((a, i) => ({
      index: i,
      filename: a.filename || `attachment-${i + 1}`,
      contentType: a.contentType,
      size: a.size,
      inline: a.contentDisposition === "inline" && !!a.cid,
      cid: a.cid || null,
      url: `${base}/${i}${q}`,
    }));
    let html = p.html ? String(p.html) : textToHtml(p.text || "");
    // Point inline images (cid:...) at our attachment download route.
    for (const a of attachments) {
      if (a.cid) html = html.split(`cid:${a.cid}`).join(a.url);
    }
    return {
      uid: n,
      folder,
      subject: p.subject || "(no subject)",
      from: list(p.from),
      to: list(p.to),
      cc: list(p.cc),
      replyTo: list(p.replyTo),
      date: (p.date || new Date()).toISOString(),
      messageId: p.messageId || null,
      references: Array.isArray(p.references) ? p.references : p.references ? [p.references] : [],
      flagged: m.flags?.has("\\Flagged") ?? false,
      html: cleanHtml(html),
      text: p.text || "",
      attachments: attachments.filter((a) => !a.inline),
    };
  });
  if (!out) return fail("That message is gone. It may have been moved or deleted.", 404);
  return json(out);
});
