import nodemailer from "nodemailer";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { fail, json } from "@/lib/http";
import { adminRoute, audit, ROLES } from "@/lib/org";
import { mailcow } from "@/lib/mailcow";
import { hasDb, q } from "@/lib/db";
import { strongPassword } from "@/lib/secret";
import { config } from "@/lib/config";
import { adminFail } from "@/lib/adminhttp";

const Body = z.object({
  emails: z.array(z.string().trim().email()).min(1).max(20),
  role: z.enum(ROLES as [string, ...string[]]),
  mailbox: z
    .object({ local: z.string().trim().regex(/^[a-z0-9._-]{1,64}$/i, "Use letters, numbers, dots, dashes or underscores."), domain: z.string() })
    .optional(),
  name: z.string().trim().max(120).optional(),
});

const APP_URL = process.env.APP_URL || "https://mailtide.apps.sentire.solutions";

/** Invites people by email with a role. With a mailbox, it is created now and they set its password from the link (7 days). */
export const POST = adminRoute(async ({ user, org, role }, req: Request) => {
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail(p.error.issues[0]?.message || "Check the invitation details.");
  const b = p.data;
  if (b.role === "Org Owner" && role !== "Org Owner") return fail("Only Org Owners can invite another Org Owner.", 403);
  if (!hasDb()) return fail("The admin database is not connected yet.", 503);
  if (b.mailbox && b.emails.length > 1) return fail("Invite one person at a time when creating a mailbox.");
  if (b.mailbox && !org.domains.includes(b.mailbox.domain)) return fail("Pick one of your organization's domains.", 403);
  try {
    let mailbox: string | null = null;
    if (b.mailbox) {
      mailbox = `${b.mailbox.local.toLowerCase()}@${b.mailbox.domain}`;
      // A random password nobody knows; the invited person sets their own from the link.
      await mailcow.addMailbox({ local_part: b.mailbox.local.toLowerCase(), domain: b.mailbox.domain, name: b.name || b.mailbox.local, password: strongPassword(), quotaMb: 5120 });
    }
    const transport = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      requireTLS: config.smtpPort !== 465,
      auth: { user: user.email, pass: user.password },
    });
    for (const email of b.emails) {
      const token = randomBytes(24).toString("base64url");
      await q("insert into invites (token, org, email, mailbox, role, invited_by, expires_at) values ($1,$2,$3,$4,$5,$6, now() + interval '7 days')", [token, org.name, email.toLowerCase(), mailbox, b.role, user.email]);
      const link = `${APP_URL}/welcome?t=${token}`;
      await transport.sendMail({
        from: user.name ? { name: user.name, address: user.email } : user.email,
        to: email,
        subject: `You're invited to ${org.name} on MailTide`,
        text: [
          `${user.name || user.email} invited you to join ${org.name} on MailTide as ${b.role}.`,
          mailbox ? `\nYour new mailbox: ${mailbox}` : "",
          `\nAccept the invitation${mailbox ? " and choose your password" : ""}:\n${link}`,
          `\nThe link works for 7 days.`,
        ].join("\n"),
        headers: { "X-Mailer": "MailTide by Sentire" },
      });
      await audit(org.name, user.email, "Members", `Invited ${email} as ${b.role}${mailbox ? ` with mailbox ${mailbox}` : ""}`);
    }
    return json({ ok: true, mailbox });
  } catch (e) {
    return adminFail(e);
  }
});
