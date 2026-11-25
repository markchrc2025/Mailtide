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
