import nodemailer from "nodemailer";
import { z } from "zod";
import { authed, fail, json } from "@/lib/http";
import { buildEvent, createEvent, deleteEvent, listCalendars } from "@/lib/dav";
import { davFail } from "@/lib/davhttp";
import { config } from "@/lib/config";

const Email = z.string().trim().email().max(254);
const Body = z.object({
  calendar: z.string().max(500).optional(),
  title: z.string().max(500).default(""),
  start: z.string().max(40),
  end: z.string().max(40),
  allDay: z.boolean().default(false),
  location: z.string().max(500).optional(),
  description: z.string().max(20000).optional(),
  meetingLink: z.string().url().max(1000).optional().or(z.literal("")),
  required: z.array(Email).max(100).default([]),
  optional: z.array(Email).max(100).default([]),
  busy: z.boolean().default(true),
  isPrivate: z.boolean().default(false),
  reminderMinutes: z.number().int().min(0).max(40320).nullable().default(15),
  repeat: z.enum(["none", "daily", "weekly", "monthly", "yearly"]).default("none"),
  category: z.string().max(100).optional(),
});

export const POST = authed(async (user, req: Request) => {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const bad = parsed.error.issues.find((i) => ["required", "optional"].includes(String(i.path[0])));
    return fail(bad ? "One of the attendee addresses is not valid." : parsed.error.issues.some((i) => i.path[0] === "meetingLink") ? "The meeting link is not a valid web address." : "The event could not be read.");
  }
  const b = { ...parsed.data, meetingLink: parsed.data.meetingLink || undefined };
  const s = new Date(b.start), e = new Date(b.end);
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return fail("The end must be after the start.");
  try {
    const cal = b.calendar || (await listCalendars(user))[0]?.href;
    if (!cal) return fail("No calendar was found for this mailbox.", 404);
    const saved = await createEvent(user, { ...b, calendar: cal });
    // Invitations go out from the organizer's own mailbox, like any email they send.
    const invitees = [...b.required, ...b.optional].filter((a) => a.toLowerCase() !== user.email.toLowerCase());
    let invited = 0;
    if (invitees.length) {
      const transport = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpPort === 465,
        requireTLS: config.smtpPort !== 465,
        auth: { user: user.email, pass: user.password },
      });
      const when = b.allDay ? b.start.slice(0, 10) : s.toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "full", timeStyle: "short" });
      await transport.sendMail({
        from: user.name ? { name: user.name, address: user.email } : user.email,
        to: b.required.filter((a) => invitees.includes(a)),
        cc: b.optional.filter((a) => invitees.includes(a)),
        subject: `Invitation: ${b.title || "(no title)"}`,
        text: [`${b.title || "(no title)"}`, `When: ${when}`, b.location ? `Where: ${b.location}` : "", b.meetingLink ? `Join: ${b.meetingLink}` : "", "", b.description || ""].filter((x) => x !== undefined).join("\n"),
        icalEvent: { method: "REQUEST", content: buildEvent({ ...b, calendar: cal }, { email: user.email, name: user.name }, saved.uid, "REQUEST") },
        headers: { "X-Mailer": "MailTide by Sentire" },
      });
      invited = invitees.length;
    }
    return json({ ok: true, ...saved, invited });
  } catch (err) {
    return davFail(err);
  }
});

export const DELETE = authed(async (user, req: Request) => {
  const href = new URL(req.url).searchParams.get("href") || "";
  if (!href) return fail("Which event?");
  try {
    await deleteEvent(user, href);
    return json({ ok: true });
  } catch (e) {
    return davFail(e);
  }
});
