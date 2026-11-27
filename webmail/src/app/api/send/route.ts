import nodemailer from "nodemailer";
import MailComposer from "nodemailer/lib/mail-composer";
import { z } from "zod";
import { authed, fail, json } from "@/lib/http";
import { withImap } from "@/lib/imap";
import { folderFor } from "@/lib/folders";
import { config } from "@/lib/config";
import { textToHtml } from "@/lib/mail";
import { boxFor } from "@/lib/shared";
import { hasDb, q } from "@/lib/db";

const Addr = z.string().trim().email().max(254);
const Body = z.object({
  mode: z.enum(["send", "draft"]).default("send"),
  to: z.array(Addr).max(100).default([]),
  cc: z.array(Addr).max(100).default([]),
  bcc: z.array(Addr).max(100).default([]),
  subject: z.string().max(998).default(""),
  text: z.string().max(2_000_000).default(""),
  fromName: z.string().max(200).optional(),
  inReplyTo: z.string().max(998).optional(),
  references: z.array(z.string().max(998)).max(100).optional(),
  replyToUid: z.number().int().positive().optional(),
  replyFolder: z.string().max(300).optional(),
  draftUid: z.number().int().positive().optional(),
  threadKey: z.string().max(300).optional(),
  attachments: z
    .array(z.object({ filename: z.string().max(255), contentType: z.string().max(200), data: z.string() }))
    .max(20)
    .default([]),
});

const MAX_ATTACH = 20 * 1024 * 1024;

export const POST = authed(async (user, req: Request) => {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const bad = parsed.error.issues.find((i) => ["to", "cc", "bcc"].includes(String(i.path[0])));
    return fail(bad ? "One of the email addresses is not valid." : "The message could not be read.");
  }
  const b = parsed.data;
  // Sending from a shared mailbox needs Send as or Full access; the reply goes out as that address.
  const box = await boxFor(user, req, "sendas");
  const shared = box.shared;
  if (b.mode === "send" && b.to.length + b.cc.length + b.bcc.length === 0) return fail("Add at least one recipient.");

  const files = b.attachments.map((a) => ({ filename: a.filename, contentType: a.contentType, content: Buffer.from(a.data, "base64") }));
  if (files.reduce((s, f) => s + f.content.length, 0) > MAX_ATTACH) return fail("Attachments can be up to 20 MB in total.");

  const from = shared ? { name: shared.name, address: box.email } : b.fromName ? { name: b.fromName, address: user.email } : user.email;
  if (shared?.options?.sentByLine && b.mode === "send") b.text = `${b.text}\n\nSent by ${user.name || user.email}`;
  const mail = {
    from,
    to: b.to,
    cc: b.cc,
    bcc: b.bcc,
    subject: b.subject,
    text: b.text,
    html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.55">${textToHtml(b.text)}</div>`,
    inReplyTo: b.inReplyTo,
    references: b.references,
    attachments: files,
    headers: { "X-Mailer": "MailTide by Sentire", ...(shared ? { "X-MailTide-Sent-By": user.email } : {}) },
  };
  const node = new MailComposer(mail).compile();
  // Drafts keep their Bcc line so it is still there when the draft is opened again.
  (node as unknown as { keepBcc: boolean }).keepBcc = b.mode === "draft";
  const raw = await node.build();

  if (b.mode === "send") {
    const transport = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      requireTLS: config.smtpPort !== 465,
      auth: { user: box.email, pass: box.password },
    });
    try {
      await transport.sendMail({ envelope: { from: box.email, to: [...b.to, ...b.cc, ...b.bcc] }, raw });
    } catch (e) {
      const err = e as { responseCode?: number; message?: string };
      console.error("[mailtide] send", err.message);
      if (err.responseCode && err.responseCode >= 500) return fail(`The mail server refused the message: ${err.message ?? ""}`.trim(), 422);
      return fail("The message was not sent. Please try again.", 502);
    }
  }

  // Keep a copy in Sent (or save the draft), then tidy up.
  await withImap(box, async (c) => {
    const target = await folderFor(c, b.mode === "send" ? "sent" : "drafts");
    await c.append(target, raw, b.mode === "send" ? ["\\Seen"] : ["\\Seen", "\\Draft"]);
    if (b.draftUid) {
      const drafts = await folderFor(c, "drafts");
      const lock = await c.getMailboxLock(drafts);
      try {
        await c.messageDelete(String(b.draftUid), { uid: true });
      } finally {
        lock.release();
      }
    }
    if (b.mode === "send" && b.replyToUid && b.replyFolder) {
      const lock = await c.getMailboxLock(b.replyFolder);
      try {
        await c.messageFlagsAdd(String(b.replyToUid), ["\\Answered"], { uid: true });
      } finally {
        lock.release();
      }
    }
  });

  // Team view: remember who replied, and clear their "is replying" status.
  if (shared && b.mode === "send" && b.threadKey && hasDb()) {
    await q(
      "insert into replies (mailbox, thread, member, name, at) values ($1,$2,$3,$4, now()) on conflict (mailbox, thread) do update set member = excluded.member, name = excluded.name, at = now()",
      [box.email, b.threadKey, user.email, user.name || user.email.split("@")[0]],
    ).catch(() => null);
    await q("delete from presence where mailbox = $1 and thread = $2 and member = $3", [box.email, b.threadKey, user.email]).catch(() => null);
  }
  return json({ ok: true, mode: b.mode });
});
