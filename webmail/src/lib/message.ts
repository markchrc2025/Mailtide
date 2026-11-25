import type { ImapFlow, SearchObject } from "imapflow";
import { simpleParser, type AddressObject } from "mailparser";
import { cleanHtml, textToHtml } from "./mail";
import { folderFor } from "./folders";
import { idsOf, normId, orderThread } from "./thread";

function list(a?: AddressObject | AddressObject[]) {
  const arr = Array.isArray(a) ? a : a ? [a] : [];
  return arr.flatMap((x) => x.value.map((v) => ({ name: v.name || "", address: v.address || "" })));
}

/** Fetches and parses one message from the folder that is already open on c. */
export async function parseOne(c: ImapFlow, folder: string, uid: number, markSeen: boolean) {
  const m = await c.fetchOne(String(uid), { uid: true, flags: true, source: true }, { uid: true });
  if (!m || !m.source) return null;
  const unseen = !m.flags?.has("\\Seen");
  if (markSeen && unseen) await c.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
  const p = await simpleParser(m.source);
  const base = `/api/messages/${uid}/attachments`;
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
  for (const a of attachments) {
    if (a.cid) html = html.split(`cid:${a.cid}`).join(a.url);
  }
  return {
    uid,
    folder,
    subject: p.subject || "(no subject)",
    from: list(p.from),
    to: list(p.to),
    cc: list(p.cc),
    replyTo: list(p.replyTo),
    date: (p.date || new Date()).toISOString(),
    messageId: p.messageId || null,
    inReplyTo: (p.inReplyTo as string | undefined) || null,
    references: Array.isArray(p.references) ? p.references : p.references ? [p.references] : [],
    flagged: m.flags?.has("\\Flagged") ?? false,
    unread: unseen && !markSeen,
    html: cleanHtml(html),
    text: p.text || "",
    attachments: attachments.filter((a) => !a.inline),
  };
}

type Full = NonNullable<Awaited<ReturnType<typeof parseOne>>>;

const MAX_IN_THREAD = 40;

/** Locks a folder; if it was already open on this pooled connection, NOOP refreshes the view. */
async function openFresh(c: ImapFlow, f: string) {
  const wasOpen = typeof c.mailbox === "object" && c.mailbox.path === f;
  const lock = await c.getMailboxLock(f);
  if (wasOpen) await c.noop();
  return lock;
}

/** Finds UIDs in the open folder whose headers mention any of the ids. */
async function searchIds(c: ImapFlow, ids: string[]): Promise<number[]> {
  if (!ids.length) return [];
  const terms: SearchObject[] = ids.flatMap((id): SearchObject[] => [
    { header: { "message-id": id } },
    { header: { "in-reply-to": id } },
    { header: { references: id } },
  ]);
  const found = new Set<number>();
  // Keep each SEARCH small; some servers dislike long OR chains.
  for (let i = 0; i < terms.length; i += 12) {
    const part = terms.slice(i, i + 12);
    const r = await c.search(part.length === 1 ? part[0] : { or: part }, { uid: true });
    for (const u of r || []) found.add(u);
  }
  return [...found];
}

/**
 * Loads the opened message and the rest of its conversation from the open
 * folder, Inbox and Sent. Marks the opened message read. Newest first.
 */
export async function loadThread(c: ImapFlow, folder: string, uid: number): Promise<{ opened: Full; messages: Full[] } | null> {
  let sent = "";
  try {
    sent = await folderFor(c, "sent");
  } catch {
    /* no Sent folder: search the others only */
  }
  const folders = [...new Set([folder, "INBOX", sent].filter(Boolean))];

  const lock0 = await openFresh(c, folder);
  let opened: Full | null;
  try {
    opened = await parseOne(c, folder, uid, true);
  } finally {
    lock0.release();
  }
  if (!opened) return null;

  const all: Full[] = [opened];
  const have = new Set([`${folder}\u0000${uid}`]);
  let ids = idsOf(opened);
  // Two passes catch replies to replies that only reference a middle message.
  for (let pass = 0; pass < 2 && ids.length && all.length < MAX_IN_THREAD; pass++) {
    const before = new Set(ids);
    for (const f of folders) {
      const lock = await openFresh(c, f);
      try {
        const uids = await searchIds(c, ids);
        for (const u of uids.sort((a, b) => b - a)) {
          const key = `${f}\u0000${u}`;
          if (have.has(key) || all.length >= MAX_IN_THREAD) continue;
          have.add(key);
          const m = await parseOne(c, f, u, false);
          if (m) all.push(m);
        }
      } catch {
        /* a folder that cannot be searched is skipped */
      } finally {
        lock.release();
      }
    }
    const next = new Set(before);
    for (const m of all) for (const x of idsOf(m)) next.add(x);
    if (next.size === before.size) break;
    ids = [...next];
  }
  const messages = orderThread(all, folder);
  const openedId = normId(opened.messageId);
  const kept = messages.find((m) => (openedId ? normId(m.messageId) === openedId : m.uid === uid && m.folder === folder));
  return { opened: kept && kept.folder === folder ? kept : opened, messages };
}
