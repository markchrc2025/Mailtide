import { ImapFlow } from "imapflow";
import { config } from "./config";

type Creds = { email: string; password: string };

// A tiny per-user connection pool. Opening IMAP over TLS costs ~300 ms,
// so we keep one connection per mailbox for a short while and reuse it.
type Entry = { client: ImapFlow; lastUsed: number; busy: Promise<unknown> };
const g = globalThis as unknown as { __mtPool?: Map<string, Entry> };
const pool: Map<string, Entry> = (g.__mtPool ??= new Map());
const IDLE_MS = 90_000;

setInterval(() => {
  const now = Date.now();
  for (const [k, e] of pool) {
    if (now - e.lastUsed > IDLE_MS) {
      pool.delete(k);
      e.client.logout().catch(() => e.client.close());
    }
  }
}, 30_000).unref?.();

export function newClient({ email, password }: Creds) {
  return new ImapFlow({
    host: config.imapHost,
    port: config.imapPort,
    secure: true,
    auth: { user: email, pass: password },
    logger: false,
    emitLogs: false,
    socketTimeout: 60_000,
  });
}

/** Checks a username and password against mailcow by signing in to IMAP. */
export async function verifyLogin(creds: Creds): Promise<boolean> {
  const c = newClient(creds);
  try {
    await c.connect();
    await c.logout();
    return true;
  } catch (e) {
    const err = e as { authenticationFailed?: boolean; responseStatus?: string };
    if (err.authenticationFailed || err.responseStatus === "NO") return false;
    throw e;
  }
}

async function getClient(creds: Creds): Promise<Entry> {
  const key = creds.email.toLowerCase();
  const existing = pool.get(key);
  if (existing && existing.client.usable) return existing;
  if (existing) pool.delete(key);
  const client = newClient(creds);
  client.on("error", () => pool.delete(key));
  client.on("close", () => pool.delete(key));
  await client.connect();
  const entry: Entry = { client, lastUsed: Date.now(), busy: Promise.resolve() };
  pool.set(key, entry);
  return entry;
}

/** Runs fn with a pooled IMAP client; calls for the same mailbox run one at a time. */
export async function withImap<T>(creds: Creds, fn: (c: ImapFlow) => Promise<T>): Promise<T> {
  const entry = await getClient(creds);
  const run = entry.busy.then(async () => {
    entry.lastUsed = Date.now();
    return fn(entry.client);
  });
  entry.busy = run.catch(() => undefined);
  try {
    return await run;
  } catch (e) {
    // A broken connection should not poison the next request.
    if (!entry.client.usable) pool.delete(creds.email.toLowerCase());
    throw e;
  }
}

/** Runs fn with the folder opened (and locked) on a pooled client. */
export async function withFolder<T>(creds: Creds, folder: string, fn: (c: ImapFlow) => Promise<T>): Promise<T> {
  return withImap(creds, async (c) => {
    const wasOpen = typeof c.mailbox === "object" && c.mailbox.path === folder;
    const lock = await c.getMailboxLock(folder);
    try {
      // A reused connection may still hold an old view of the folder;
      // NOOP makes the server report mail that arrived since.
      if (wasOpen) await c.noop();
      return await fn(c);
    } finally {
      lock.release();
    }
  });
}
