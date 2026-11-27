// Browser-side helpers: API calls and display formatting.
export type Address = { name: string; address: string };
export type Folder = { path: string; name: string; role: string; unseen: number; total: number };
export type MessageRow = {
  uid: number;
  subject: string;
  from: Address[];
  to: Address[];
  date: string;
  seen: boolean;
  flagged: boolean;
  answered: boolean;
  attachments: boolean;
  snippet: string;
  /** Every email in this conversation row (newest first) and how many. */
  uids?: number[];
  count?: number;
  key?: string;
  members?: { uid: number; from: Address[]; date: string; seen: boolean; snippet: string; subject: string }[];
};
export type Attachment = { index: number; filename: string; contentType: string; size: number; url: string };
export type FullMessage = {
  uid: number;
  folder: string;
  subject: string;
  from: Address[];
  to: Address[];
  cc: Address[];
  replyTo: Address[];
  date: string;
  messageId: string | null;
  inReplyTo?: string | null;
  references: string[];
  flagged: boolean;
  unread?: boolean;
  html: string;
  text: string;
  attachments: Attachment[];
};

export type Thread = { subject: string; opened: { uid: number; folder: string }; messages: FullMessage[] };

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, init?: RequestInit & { body?: string }): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && typeof window !== "undefined" && !path.includes("/auth/")) {
    window.location.href = "/login?expired=1";
  }
  if (!res.ok) throw new ApiError((data as { error?: string }).error || "Something went wrong.", res.status);
  return data as T;
}

export function displayName(a?: Address): string {
  if (!a) return "Unknown";
  return a.name || a.address.split("@")[0] || a.address;
}

export function initials(a?: Address): string {
  const n = displayName(a).replace(/["']/g, "").trim();
  const parts = n.split(/[\s._-]+/).filter(Boolean);
  const s = (parts[0]?.[0] || "?") + (parts.length > 1 ? parts[parts.length - 1][0] : parts[0]?.[1] || "");
  return s.toUpperCase();
}

// Soft avatar colours taken from the Sentire product palette.
const AVATARS: Array<[string, string]> = [
  ["#E9DCEF", "#5E3E86"],
  ["#DCE7F4", "#2F5585"],
  ["#F2E6CF", "#7A5719"],
  ["#DCEFE4", "#2E6A4E"],
  ["#F4E0D6", "#A3431D"],
  ["#E9E3DB", "#5A5048"],
];
export function avatarColors(seed: string): [string, string] {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATARS[h % AVATARS.length];
}

const TZ = "Asia/Manila";
export function shortDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toLocaleDateString("en-PH", { timeZone: TZ }) === now.toLocaleDateString("en-PH", { timeZone: TZ });
  if (sameDay) return d.toLocaleTimeString("en-PH", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
  const yest = new Date(now.getTime() - 86_400_000);
  if (d.toLocaleDateString("en-PH", { timeZone: TZ }) === yest.toLocaleDateString("en-PH", { timeZone: TZ })) return "Yesterday";
  const days = (now.getTime() - d.getTime()) / 86_400_000;
  if (days < 6) return d.toLocaleDateString("en-PH", { timeZone: TZ, weekday: "short" });
  if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString("en-PH", { timeZone: TZ, day: "numeric", month: "short" });
  return d.toLocaleDateString("en-PH", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" });
}

export function longDate(iso: string): string {
  return new Date(iso).toLocaleString("en-PH", { timeZone: TZ, dateStyle: "medium", timeStyle: "short" });
}

export function fileSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function splitAddresses(s: string): string[] {
  return s
    .split(/[,;\n]/)
    .map((x) => x.trim())
    .map((x) => (x.match(/<([^>]+)>/)?.[1] ?? x).trim())
    .filter(Boolean);
}

export function formatAddress(a: Address): string {
  return a.name ? `${a.name} <${a.address}>` : a.address;
}

export function quoteText(m: FullMessage): string {
  const who = m.from[0] ? formatAddress(m.from[0]) : "someone";
  const body = (m.text || "").trim().split("\n").map((l) => `> ${l}`).join("\n");
  return `\n\nOn ${longDate(m.date)}, ${who} wrote:\n${body}`;
}

export function prefixSubject(prefix: "Re" | "Fwd", s: string): string {
  const re = new RegExp(`^${prefix}:`, "i");
  return re.test(s.trim()) ? s : `${prefix}: ${s}`;
}

/** Outlook-style date groups for the message list. */
export function dateGroup(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Older";
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86400000);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  const dow = (now.getDay() + 6) % 7; // Monday = 0
  if (diff <= dow) return "This week";
  if (diff <= dow + 7) return "Last week";
  if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) return "Earlier this month";
  if (d.getFullYear() === now.getFullYear()) return d.toLocaleString("en", { month: "long" });
  return "Older";
}
