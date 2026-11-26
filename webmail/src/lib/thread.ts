/**
 * Conversation (thread) helpers. A thread is every message linked by
 * Message-ID, In-Reply-To and References, found in the open folder, Inbox and
 * Sent, shown newest first like Outlook's conversation view.
 */

export type ThreadKey = { messageId: string | null; inReplyTo?: string | null; references: string[] };

/** Normalises a Message-ID to <id> form, lower case, or null. */
export function normId(id: string | null | undefined): string | null {
  if (!id) return null;
  const t = id.trim().replace(/^<|>$/g, "").trim();
  return t ? `<${t.toLowerCase()}>` : null;
}

/** Every Message-ID this message points at, including its own. */
export function idsOf(m: ThreadKey): string[] {
  const out = new Set<string>();
  for (const x of [m.messageId, m.inReplyTo ?? null, ...m.references]) {
    const n = normId(x);
    if (n) out.add(n);
  }
  return [...out];
}

/** True when two messages share any Message-ID in their chains. */
export function linked(a: ThreadKey, b: ThreadKey): boolean {
  const s = new Set(idsOf(a));
  return idsOf(b).some((x) => s.has(x));
}

/**
 * Keeps one copy per Message-ID (the copy in preferFolder wins, so the open
 * message is the one shown) and sorts newest first.
 */
export function orderThread<T extends ThreadKey & { date: string; folder: string; uid: number }>(
  msgs: T[],
  preferFolder: string,
): T[] {
  const byId = new Map<string, T>();
  const noId: T[] = [];
  for (const m of msgs) {
    const id = normId(m.messageId);
    if (!id) {
      noId.push(m);
      continue;
    }
    const cur = byId.get(id);
    if (!cur || (m.folder === preferFolder && cur.folder !== preferFolder)) byId.set(id, m);
  }
  const seen = new Set<string>();
  return [...byId.values(), ...noId]
    .filter((m) => {
      const k = `${m.folder}\u0000${m.uid}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}

/** Hides quoted history in a message body behind a toggle, like Outlook's "...". */
export function hasQuote(html: string): boolean {
  return /<blockquote|class="(gmail_quote|mt-quote)"|id="(divRplyFwdMsg|appendonsend)"/i.test(html);
}

const PREFIX = /^\s*(re|fw|fwd|aw|sv|antw|tr|rv|wg)\s*(\[\d+\])?\s*:/i;

/** Subject without reply and forward prefixes, lower case, for grouping. */
export function topicOf(subject: string): string {
  let s = (subject || "").trim();
  for (;;) {
    const n = s.replace(PREFIX, "").trim();
    if (n === s) break;
    s = n;
  }
  return s.replace(/\s+/g, " ").toLowerCase();
}

export type ListRow = {
  uid: number;
  subject: string;
  date: string;
  seen: boolean;
  flagged: boolean;
  attachments: boolean;
  messageId?: string | null;
  inReplyTo?: string | null;
};

/**
 * Folds list rows into conversations, like Outlook's list. Two rows join when
 * one replies to the other, or when they share a topic and at least one of
 * that topic's rows is a reply or forward (so two unrelated emails that both
 * say "Invoice" stay apart). The newest row leads; the group is unread if any
 * member is unread.
 */
export function groupRows<T extends ListRow>(rows: T[]): Array<T & { uids: number[]; count: number }> {
  const parent = rows.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const join = (a: number, b: number) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };
  const byId = new Map<string, number>();
  rows.forEach((r, i) => {
    const id = normId(r.messageId);
    if (id) byId.set(id, i);
  });
  rows.forEach((r, i) => {
    const p = normId(r.inReplyTo);
    if (p && byId.has(p)) join(i, byId.get(p) as number);
  });
  const topics = new Map<string, number[]>();
  rows.forEach((r, i) => {
    const t = topicOf(r.subject);
    if (!t || t === "(no subject)") return;
    topics.set(t, [...(topics.get(t) || []), i]);
  });
  for (const idx of topics.values()) {
    if (idx.length < 2 || !idx.some((i) => PREFIX.test(rows[i].subject))) continue;
    for (const i of idx.slice(1)) join(idx[0], i);
  }
  const groups = new Map<number, T[]>();
  rows.forEach((r, i) => {
    const g = find(i);
    groups.set(g, [...(groups.get(g) || []), r]);
  });
  const out: Array<T & { uids: number[]; count: number }> = [];
  for (const members of groups.values()) {
    members.sort((a, b) => Date.parse(b.date) - Date.parse(a.date) || b.uid - a.uid);
    const lead = members[0];
    out.push({
      ...lead,
      seen: members.every((m) => m.seen),
      flagged: members.some((m) => m.flagged),
      attachments: members.some((m) => m.attachments),
      uids: members.map((m) => m.uid),
      count: members.length,
    });
  }
  return out.sort((a, b) => Date.parse(b.date) - Date.parse(a.date) || b.uid - a.uid);
}
