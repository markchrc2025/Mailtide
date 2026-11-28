// Calendar (CalDAV) and contacts (CardDAV) for the signed-in mailbox, read from
// mailcow's SOGo. Each person reaches only their own collections with their own
// sign-in, so the server never sees anyone else's data.
import ICAL from "ical.js";
import { randomUUID } from "node:crypto";

type Creds = { email: string; password: string };

export const DAV_BASE = (process.env.DAV_URL || "https://mx.sentire.solutions/SOGo/dav").replace(/\/$/, "");

const plainPath = (p: string) => {
  let out = p;
  try {
    out = decodeURIComponent(p);
  } catch {
    /* keep as is */
  }
  return out.toLowerCase();
};

/**
 * True when a DAV href sits under the signed-in user's own collection. The server answers with the
 * address written either as test@x or test%40x, so both sides are decoded before comparing; ".." is refused.
 */
export function underOwn(user: { email: string }, href: string, sub: string) {
  const path = plainPath(href.replace(/^https?:\/\/[^/]+/i, ""));
  if (path.split("/").includes("..")) return false;
  return path.startsWith(plainPath(`${new URL(DAV_BASE).pathname}/${user.email}/${sub}`));
}
const ORIGIN = new URL(DAV_BASE).origin;

export class DavError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function dav(user: Creds, url: string, method: string, body?: string, headers: Record<string, string> = {}) {
  const res = await fetch(url.startsWith("http") ? url : ORIGIN + url, {
    method,
    body,
    headers: {
      Authorization: "Basic " + Buffer.from(`${user.email}:${user.password}`).toString("base64"),
      ...(body ? { "Content-Type": headers["Content-Type"] || "application/xml; charset=utf-8" } : {}),
      ...headers,
    },
    cache: "no-store",
  });
  if (res.status === 401) throw new DavError(401, "Your password was changed. Please sign in again.");
  if (res.status >= 400 && res.status !== 404) throw new DavError(res.status, `The calendar server answered ${res.status}.`);
  return res;
}

const decode = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#13;/g, "\r").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, "&");

/** Splits a WebDAV multistatus reply into responses with their props (namespace prefixes ignored). */
function multistatus(xml: string) {
  const out: { href: string; props: Record<string, string>; ok: boolean }[] = [];
  const re = /<(?:[\w-]+:)?response\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?response>/g;
  for (const m of xml.matchAll(re)) {
    const block = m[1];
    const href = decode((block.match(/<(?:[\w-]+:)?href\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?href>/) || [])[1] || "").trim();
    const props: Record<string, string> = {};
    let ok = false;
    for (const ps of block.matchAll(/<(?:[\w-]+:)?propstat\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?propstat>/g)) {
      if (!/200/.test((ps[1].match(/<(?:[\w-]+:)?status\b[^>]*>([\s\S]*?)</) || [])[1] || "")) continue;
      ok = true;
      const prop = (ps[1].match(/<(?:[\w-]+:)?prop\b[^>]*>([\s\S]*)<\/(?:[\w-]+:)?prop>/) || [])[1] || "";
      for (const p of prop.matchAll(/<(?:[\w-]+:)?([\w-]+)\b[^>]*?(?:\/>|>([\s\S]*?)<\/(?:[\w-]+:)?\1>)/g)) {
        props[p[1]] = p[2] === undefined ? "" : p[2];
      }
    }
    out.push({ href, props, ok });
  }
  return out;
}

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const fold = (line: string) => {
  const parts: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest) > 74) {
    let cut = 74;
    while (Buffer.byteLength(rest.slice(0, cut)) > 74) cut--;
    parts.push(rest.slice(0, cut));
    rest = " " + rest.slice(cut);
  }
  parts.push(rest);
  return parts.join("\r\n");
};
const ics = (lines: string[]) => lines.filter(Boolean).map(fold).join("\r\n") + "\r\n";
const utc = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

// ---------------------------------------------------------------- calendars

export type CalendarInfo = { href: string; name: string; color: string };

const PALETTE = ["#E8693A", "#2F5B8A", "#2C6B3A", "#8A4FA3", "#B07A1E"];

export async function listCalendars(user: Creds): Promise<CalendarInfo[]> {
  const res = await dav(
    user,
    `${DAV_BASE}/${encodeURIComponent(user.email)}/Calendar/`,
    "PROPFIND",
    `<?xml version="1.0"?><d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:a="http://apple.com/ns/ical/"><d:prop><d:displayname/><d:resourcetype/><a:calendar-color/></d:prop></d:propfind>`,
    { Depth: "1" },
  );
  const list = multistatus(await res.text())
    .filter((r) => r.ok && /calendar/.test(r.props.resourcetype || ""))
    .map((r, i) => ({
      href: r.href,
      name: decode(r.props.displayname || "") || "Calendar",
      color: (r.props["calendar-color"] || "").slice(0, 7) || PALETTE[i % PALETTE.length],
    }));
  return list;
}

export type CalEvent = {
  id: string; // occurrence id: href plus recurrence start
  href: string;
  etag: string;
  uid: string;
  calendar: string;
  title: string;
  start: string; // ISO
  end: string;
  allDay: boolean;
  location: string;
  description: string;
  url: string;
  busy: boolean;
  isPrivate: boolean;
  recurring: boolean;
  organizer: string;
  attendees: { email: string; name: string; optional: boolean; status: string }[];
};

function registerZones(vcal: ICAL.Component) {
  for (const tz of vcal.getAllSubcomponents("vtimezone")) {
    try {
      const zone = new ICAL.Timezone(tz);
      if (!ICAL.TimezoneService.has(zone.tzid)) ICAL.TimezoneService.register(zone);
    } catch {
      /* a broken zone falls back to floating time */
    }
  }
}

function toEvent(ev: ICAL.Event, href: string, etag: string, calendar: string, start: ICAL.Time, end: ICAL.Time, recurring: boolean): CalEvent {
  const c = ev.component;
  const attendees = c.getAllProperties("attendee").map((p) => ({
    email: String(p.getFirstValue() || "").replace(/^mailto:/i, ""),
    name: String(p.getParameter("cn") || ""),
    optional: String(p.getParameter("role") || "").toUpperCase() === "OPT-PARTICIPANT",
    status: String(p.getParameter("partstat") || "NEEDS-ACTION"),
  }));
  return {
    id: `${href}#${start.toString()}`,
    href,
    etag,
    uid: ev.uid,
    calendar,
    title: ev.summary || "(no title)",
    start: start.toJSDate().toISOString(),
    end: end.toJSDate().toISOString(),
    allDay: start.isDate,
    location: ev.location || "",
    description: ev.description || "",
    url: String(c.getFirstPropertyValue("url") || ""),
    busy: String(c.getFirstPropertyValue("transp") || "OPAQUE").toUpperCase() !== "TRANSPARENT",
    isPrivate: String(c.getFirstPropertyValue("class") || "").toUpperCase() === "PRIVATE",
    recurring,
    organizer: String(c.getFirstPropertyValue("organizer") || "").replace(/^mailto:/i, ""),
    attendees,
  };
}

export async function listEvents(user: Creds, cal: string, from: Date, to: Date): Promise<CalEvent[]> {
  const res = await dav(
    user,
    cal,
    "REPORT",
    `<?xml version="1.0"?><c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><d:getetag/><c:calendar-data/></d:prop><c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT"><c:time-range start="${utc(from)}" end="${utc(to)}"/></c:comp-filter></c:comp-filter></c:filter></c:calendar-query>`,
    { Depth: "1" },
  );
  const out: CalEvent[] = [];
  const rangeStart = ICAL.Time.fromJSDate(from, true);
  const rangeEnd = ICAL.Time.fromJSDate(to, true);
  for (const r of multistatus(await res.text())) {
    const data = decode(r.props["calendar-data"] || "");
    if (!data.trim()) continue;
    try {
      const vcal = new ICAL.Component(ICAL.parse(data));
      registerZones(vcal);
      const vevents = vcal.getAllSubcomponents("vevent");
      const master = vevents.find((v) => !v.hasProperty("recurrence-id")) || vevents[0];
      if (!master) continue;
      const ev = new ICAL.Event(master);
      for (const ex of vevents) if (ex !== master) ev.relateException(ex);
      const etag = decode(r.props.getetag || "");
      if (ev.isRecurring()) {
        const it = ev.iterator();
        let next: ICAL.Time | null;
        let guard = 0;
        while ((next = it.next()) && guard++ < 1000) {
          if (next.compare(rangeEnd) >= 0) break;
          const occ = ev.getOccurrenceDetails(next);
          if (occ.endDate.compare(rangeStart) <= 0) continue;
          out.push(toEvent(occ.item, r.href, etag, cal, occ.startDate, occ.endDate, true));
        }
      } else {
        out.push(toEvent(ev, r.href, etag, cal, ev.startDate, ev.endDate || ev.startDate, false));
      }
    } catch (e) {
      console.error("[mailtide] calendar parse", (e as Error).message);
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

export type NewEvent = {
  calendar: string;
  title: string;
  start: string; // ISO for timed, YYYY-MM-DD for all day
  end: string;
  allDay: boolean;
  location?: string;
  description?: string;
  meetingLink?: string;
  required?: string[];
  optional?: string[];
  busy?: boolean;
  isPrivate?: boolean;
  reminderMinutes?: number | null;
  repeat?: "none" | "daily" | "weekly" | "monthly" | "yearly";
  category?: string;
};

/**
 * Builds the iCalendar text for a new event. With method REQUEST it is an invitation.
 * Attendees carry no SCHEDULE-AGENT, so the server (SOGo) sends the invitation, updates and cancellation.
 */
export function buildEvent(e: NewEvent, organizer: { email: string; name?: string }, uid: string, method?: "REQUEST") {
  const dt = (iso: string, key: string) => (e.allDay ? `${key};VALUE=DATE:${iso.replace(/-/g, "").slice(0, 8)}` : `${key}:${utc(new Date(iso))}`);
  const att = (addr: string, optional: boolean) =>
    `ATTENDEE;ROLE=${optional ? "OPT-PARTICIPANT" : "REQ-PARTICIPANT"};PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${addr}`;
  const attendees = [...(e.required || []).map((a) => att(a, false)), ...(e.optional || []).map((a) => att(a, true))];
  const desc = [e.description || "", e.meetingLink ? `Join: ${e.meetingLink}` : ""].filter(Boolean).join("\n\n");
  const rule = { daily: "FREQ=DAILY", weekly: "FREQ=WEEKLY", monthly: "FREQ=MONTHLY", yearly: "FREQ=YEARLY" } as const;
  return ics([
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Sentire//MailTide//EN",
    "CALSCALE:GREGORIAN",
    method ? `METHOD:${method}` : "",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${utc(new Date())}`,
    dt(e.start, "DTSTART"),
    dt(e.end, "DTEND"),
    `SUMMARY:${esc(e.title || "(no title)")}`,
    e.location ? `LOCATION:${esc(e.location)}` : "",
    desc ? `DESCRIPTION:${esc(desc)}` : "",
    e.meetingLink ? `URL:${e.meetingLink.replace(/[\r\n]/g, "")}` : "",
    `TRANSP:${e.busy === false ? "TRANSPARENT" : "OPAQUE"}`,
    e.isPrivate ? "CLASS:PRIVATE" : "",
    e.category ? `CATEGORIES:${esc(e.category)}` : "",
    e.repeat && e.repeat !== "none" ? `RRULE:${rule[e.repeat]}` : "",
    attendees.length ? `ORGANIZER;CN=${esc(organizer.name || organizer.email)}:mailto:${organizer.email}` : "",
    ...attendees,
    ...(e.reminderMinutes != null && e.reminderMinutes >= 0
      ? ["BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(e.title || "Reminder")}`, `TRIGGER:-PT${e.reminderMinutes}M`, "END:VALARM"]
      : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ]);
}

export async function createEvent(user: Creds & { name?: string }, e: NewEvent) {
  const uid = `${randomUUID()}@mailtide.sentire.solutions`;
  const cal = e.calendar.endsWith("/") ? e.calendar : e.calendar + "/";
  const href = `${cal}${uid.split("@")[0]}.ics`;
  const res = await dav(user, href, "PUT", buildEvent(e, { email: user.email, name: user.name }, uid), {
    "Content-Type": "text/calendar; charset=utf-8",
    "If-None-Match": "*",
  });
  if (res.status >= 300) throw new DavError(res.status, "The event was not saved.");
  return { uid, href };
}

export async function deleteEvent(user: Creds, href: string) {
  if (!underOwn(user, href, "")) throw new DavError(403, "That event is not yours.");
  await dav(user, href, "DELETE");
}

// ---------------------------------------------------------------- contacts

export type Contact = {
  href: string;
  etag: string;
  uid: string;
  name: string;
  first: string;
  last: string;
  emails: { type: string; value: string }[];
  phones: { type: string; value: string }[];
  company: string;
  title: string;
  notes: string;
  categories: string[];
  favorite: boolean;
};

const bookHref = (user: Creds) => `${DAV_BASE}/${encodeURIComponent(user.email)}/Contacts/personal/`;

function parseCard(text: string, href = "", etag = ""): Contact | null {
  try {
    const c = new ICAL.Component(ICAL.parse(text));
    const n = c.getFirstPropertyValue("n") as unknown as string[] | null;
    const org = c.getFirstPropertyValue("org") as unknown as string[] | string | null;
    const cats = c.getAllProperties("categories").flatMap((p) => p.getValues().map(String));
    const typed = (name: string) =>
      c.getAllProperties(name).map((p) => ({ type: String(([] as string[]).concat((p.getParameter("type") as string | string[]) || "")[0] || "").toLowerCase(), value: String(p.getFirstValue() || "").replace(/^mailto:|^tel:/i, "") }));
    const first = Array.isArray(n) ? String(n[1] || "") : "";
    const last = Array.isArray(n) ? String(n[0] || "") : "";
    return {
      href,
      etag,
      uid: String(c.getFirstPropertyValue("uid") || href),
      name: String(c.getFirstPropertyValue("fn") || [first, last].filter(Boolean).join(" ") || ""),
      first,
      last,
      emails: typed("email").filter((x) => x.value),
      phones: typed("tel").filter((x) => x.value),
      company: Array.isArray(org) ? String(org[0] || "") : String(org || ""),
      title: String(c.getFirstPropertyValue("title") || ""),
      notes: String(c.getFirstPropertyValue("note") || ""),
      categories: cats.filter((x) => x && x !== "Favorites"),
      favorite: cats.includes("Favorites"),
    };
  } catch {
    return null;
  }
}

export async function listContacts(user: Creds): Promise<Contact[]> {
  const res = await dav(
    user,
    bookHref(user),
    "REPORT",
    `<?xml version="1.0"?><c:addressbook-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:carddav"><d:prop><d:getetag/><c:address-data/></d:prop></c:addressbook-query>`,
    { Depth: "1" },
  );
  if (res.status === 404) return [];
  return multistatus(await res.text())
    .map((r) => parseCard(decode(r.props["address-data"] || ""), r.href, decode(r.props.getetag || "")))
    .filter((c): c is Contact => !!c && !!(c.name || c.emails.length))
    .sort((a, b) => (a.name || a.emails[0]?.value || "").localeCompare(b.name || b.emails[0]?.value || "", "en", { sensitivity: "base" }));
}

export type ContactInput = {
  first: string;
  last: string;
  emails: { type: string; value: string }[];
  phones: { type: string; value: string }[];
  company: string;
  title: string;
  notes: string;
  categories: string[];
  favorite: boolean;
};

export function buildCard(c: ContactInput, uid: string) {
  const fn = [c.first, c.last].filter(Boolean).join(" ") || c.emails[0]?.value || "Contact";
  const cats = [...new Set([...c.categories, ...(c.favorite ? ["Favorites"] : [])])].filter(Boolean);
  return ics([
    "BEGIN:VCARD",
    "VERSION:3.0",
    "PRODID:-//Sentire//MailTide//EN",
    `UID:${uid}`,
    `FN:${esc(fn)}`,
    `N:${esc(c.last)};${esc(c.first)};;;`,
    c.company ? `ORG:${esc(c.company)}` : "",
    c.title ? `TITLE:${esc(c.title)}` : "",
    ...c.emails.filter((e) => e.value).map((e) => `EMAIL;TYPE=${(e.type || "work").toUpperCase()}:${e.value}`),
    ...c.phones.filter((p) => p.value).map((p) => `TEL;TYPE=${(p.type || "cell").toUpperCase()}:${esc(p.value)}`),
    c.notes ? `NOTE:${esc(c.notes)}` : "",
    cats.length ? `CATEGORIES:${cats.map(esc).join(",")}` : "",
    `REV:${utc(new Date())}`,
    "END:VCARD",
  ]);
}

const ownHref = (user: Creds, href: string) => underOwn(user, href, "Contacts/personal/");

export async function saveContact(user: Creds, c: ContactInput, existing?: { href: string; uid: string; etag?: string }) {
  if (existing && !ownHref(user, existing.href)) throw new DavError(403, "That contact is not yours.");
  const uid = existing?.uid || randomUUID();
  const href = existing?.href || `${new URL(bookHref(user)).pathname}${uid}.vcf`;
  const res = await dav(user, href, "PUT", buildCard(c, uid), {
    "Content-Type": "text/vcard; charset=utf-8",
    ...(existing ? {} : { "If-None-Match": "*" }),
  });
  if (res.status >= 300) throw new DavError(res.status, "The contact was not saved.");
  return { href, uid };
}

export async function deleteContact(user: Creds, href: string) {
  if (!ownHref(user, href)) throw new DavError(403, "That contact is not yours.");
  await dav(user, href, "DELETE");
}

/** Splits a .vcf file that may hold many cards and reads each one. */
export function parseVcf(text: string): ContactInput[] {
  const cards = text.replace(/\r\n/g, "\n").match(/BEGIN:VCARD[\s\S]*?END:VCARD/gi) || [];
  return cards
    .map((t) => parseCard(t))
    .filter((c): c is Contact => !!c)
    .map((c) => ({ first: c.first || c.name, last: c.last, emails: c.emails, phones: c.phones, company: c.company, title: c.title, notes: c.notes, categories: c.categories, favorite: c.favorite }));
}

export function exportVcf(list: Contact[]) {
  return list
    .map((c) => buildCard({ first: c.first || c.name, last: c.last, emails: c.emails, phones: c.phones, company: c.company, title: c.title, notes: c.notes, categories: c.categories, favorite: c.favorite }, c.uid))
    .join("");
}
