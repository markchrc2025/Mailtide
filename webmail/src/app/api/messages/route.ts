import { simpleParser } from "mailparser";
import type { FetchMessageObject, MessageAddressObject } from "imapflow";
import { authed, json } from "@/lib/http";
import { withFolder } from "@/lib/imap";
import { snippetOf } from "@/lib/mail";

export const dynamic = "force-dynamic";
const PAGE = 40;

function addr(list?: MessageAddressObject[]) {
  return (list ?? []).map((a) => ({ name: a.name || "", address: a.address || "" }));
}

function hasAttachments(node: FetchMessageObject["bodyStructure"]): boolean {
  if (!node) return false;
  if (node.disposition === "attachment") return true;
  return (node.childNodes ?? []).some(hasAttachments);
}

export const GET = authed(async (user, req: Request) => {
  const url = new URL(req.url);
  const folder = url.searchParams.get("folder") || "INBOX";
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const q = (url.searchParams.get("q") || "").trim().slice(0, 200);
  const unreadOnly = url.searchParams.get("unread") === "1";

  const result = await withFolder(user, folder, async (c) => {
    const exists = typeof c.mailbox === "object" ? c.mailbox.exists : 0;
    let uids: number[];
    if (q || unreadOnly) {
      const criteria: Record<string, unknown> = {};
      if (q) criteria.or = [{ subject: q }, { from: q }, { to: q }, { body: q }];
      if (unreadOnly) criteria.seen = false;
      uids = ((await c.search(criteria, { uid: true })) || []).sort((a, b) => b - a);
    } else {
      uids = ((await c.search({ all: true }, { uid: true })) || []).sort((a, b) => b - a);
    }
    const total = uids.length;
    const slice = uids.slice((page - 1) * PAGE, page * PAGE);
    if (!slice.length) return { total, exists, messages: [] };

    const rows: Array<Record<string, unknown>> = [];
    for await (const m of c.fetch(
      slice,
      { uid: true, flags: true, envelope: true, internalDate: true, size: true, bodyStructure: true, source: { start: 0, maxLength: 6144 } },
      { uid: true },
    )) {
      let snippet = "";
      try {
        if (m.source) {
          const parsed = await simpleParser(m.source, { skipHtmlToText: false, skipImageLinks: true });
          snippet = snippetOf(parsed.text || "");
        }
      } catch {
        /* a cut-off message part is fine; leave the snippet empty */
      }
      rows.push({
        uid: m.uid,
        subject: m.envelope?.subject || "(no subject)",
        from: addr(m.envelope?.from),
        to: addr(m.envelope?.to),
        date: (m.envelope?.date || m.internalDate || new Date()).toString(),
        seen: m.flags?.has("\\Seen") ?? false,
        flagged: m.flags?.has("\\Flagged") ?? false,
        answered: m.flags?.has("\\Answered") ?? false,
        attachments: hasAttachments(m.bodyStructure),
        size: m.size,
        snippet,
      });
    }
    rows.sort((a, b) => (b.uid as number) - (a.uid as number));
    return { total, exists, messages: rows };
  });

  return json({ folder, page, pageSize: PAGE, ...result });
});
