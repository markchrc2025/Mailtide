// mailcow admin API, used by the admin console. The key lives only in the app's
// environment (MAILCOW_API_KEY) and is limited on mailcow to the app server's IP.
export const MAILCOW_URL = (process.env.MAILCOW_API_URL || "https://mx.sentire.solutions").replace(/\/$/, "");

export function hasMailcow() {
  return !!process.env.MAILCOW_API_KEY;
}

export class MailcowError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  if (!process.env.MAILCOW_API_KEY) throw new MailcowError(503, "The admin console is not connected to mailcow yet.");
  const res = await fetch(`${MAILCOW_URL}/api/v1/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "X-API-Key": process.env.MAILCOW_API_KEY, "Content-Type": "application/json", Accept: "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new MailcowError(502, `mailcow answered ${res.status}.`);
  }
  if (res.status === 401 || (data as { type?: string; msg?: string })?.msg === "authentication failed") {
    throw new MailcowError(503, "mailcow refused the API key. Check MAILCOW_API_KEY and the allowed IP.");
  }
  if (Array.isArray(data) && data.some((x: { type?: string }) => x?.type === "danger" || x?.type === "error")) {
    const m = data.find((x: { type?: string }) => x?.type === "danger" || x?.type === "error") as { msg?: unknown };
    throw new MailcowError(422, `mailcow: ${Array.isArray(m.msg) ? m.msg.join(" ") : String(m.msg)}`);
  }
  return data as T;
}

export type McDomain = { domain_name: string; active: number | string; mboxes_in_domain: number; quota_used_in_domain: string | number; max_quota_for_domain: number; description?: string };
export type McMailbox = {
  username: string;
  name: string;
  domain: string;
  active: number | string;
  quota: number;
  quota_used: number;
  messages: number;
  last_imap_login?: number | string;
  attributes?: Record<string, string>;
};
export type McAlias = { id: number; address: string; goto: string; active: number | string; domain: string };

const list = <T>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : x && typeof x === "object" && Object.keys(x).length ? [x as T] : []);

export const mailcow = {
  domains: async () => list<McDomain>(await call("get/domain/all")),
  mailboxes: async (domain: string) => list<McMailbox>(await call(`get/mailbox/all/${encodeURIComponent(domain)}`)),
  aliases: async () => list<McAlias>(await call("get/alias/all")),
  dkim: async (domain: string) => (await call<{ dkim_txt?: string; dkim_selector?: string }>(`get/dkim/${encodeURIComponent(domain)}`)) || {},
  addMailbox: (m: { local_part: string; domain: string; name: string; password: string; quotaMb: number }) =>
    call("add/mailbox", { local_part: m.local_part, domain: m.domain, name: m.name, password: m.password, password2: m.password, quota: String(m.quotaMb), active: "1", force_pw_update: "0" }),
  editMailbox: (username: string, attr: Record<string, unknown>) => call("edit/mailbox", { items: [username], attr }),
  deleteMailbox: (username: string) => call("delete/mailbox", [username]),
  addAlias: (address: string, goto: string) => call("add/alias", { address, goto, active: "1" }),
  deleteAlias: (id: number) => call("delete/alias", [String(id)]),
  addDomain: (domain: string, description: string) =>
    call("add/domain", { domain, description, aliases: "400", mailboxes: "50", defquota: "5120", maxquota: "10240", quota: "51200", active: "1", backupmx: "0", relay_all_recipients: "0", restart_sogo: "10" }),
};
