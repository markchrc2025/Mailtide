import { z } from "zod";
import { fail, json } from "@/lib/http";
import { adminRoute, audit } from "@/lib/org";
import { mailcow } from "@/lib/mailcow";
import { hasDb, q } from "@/lib/db";
import { strongPassword } from "@/lib/secret";
import { config } from "@/lib/config";
import { adminFail } from "@/lib/adminhttp";

export const dynamic = "force-dynamic";

export const GET = adminRoute(async ({ org }) => {
  try {
    const shared = hasDb() ? (await q<{ address: string }>("select address from shared_mailboxes where org = $1", [org.name])).map((r) => r.address) : [];
    const boxes = (await Promise.all(org.domains.map((d) => mailcow.mailboxes(d)))).flat();
    return json({
      domains: org.domains,
      mailboxes: boxes.map((b) => ({
        email: b.username,
        name: b.name,
        active: String(b.active) === "1",
        quota: Number(b.quota) || 0,
        used: Number(b.quota_used) || 0,
        messages: Number(b.messages) || 0,
        shared: shared.includes(b.username),
        lastLogin: Number(b.last_imap_login) || 0,
      })),
    });
  } catch (e) {
    return adminFail(e);
  }
});

const Create = z.object({
  local: z.string().trim().regex(/^[a-z0-9._-]{1,64}$/i, "Use letters, numbers, dots, dashes or underscores in the address."),
  domain: z.string(),
  name: z.string().trim().max(120).default(""),
  password: z.string().min(10, "The password needs at least 10 characters.").max(128),
  quotaGb: z.number().min(1).max(50).default(5),
});

export const POST = adminRoute(async ({ user, org }, req: Request) => {
  const p = Create.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail(p.error.issues[0]?.message || "Check the mailbox details.");
  const b = p.data;
  if (!org.domains.includes(b.domain)) return fail("Pick one of your organization's domains.", 403);
  try {
    await mailcow.addMailbox({ local_part: b.local.toLowerCase(), domain: b.domain, name: b.name || b.local, password: b.password, quotaMb: Math.round(b.quotaGb * 1024) });
    await audit(org.name, user.email, "Mailboxes", `Mailbox ${b.local.toLowerCase()}@${b.domain} created`);
    return json({ ok: true });
  } catch (e) {
    return adminFail(e);
  }
});

const Edit = z.object({
  email: z.string().email(),
  name: z.string().trim().max(120).optional(),
  quotaGb: z.number().min(1).max(50).optional(),
  active: z.boolean().optional(),
  resetPassword: z.boolean().optional(),
  password: z.string().min(10).max(128).optional(),
});

export const PATCH = adminRoute(async ({ user, org }, req: Request) => {
  const p = Edit.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("Check the mailbox changes.");
  const b = p.data;
  if (!org.domains.includes(b.email.split("@")[1])) return fail("That mailbox is not in your organization.", 403);
  if (b.active === false && config.adminEmails.includes(b.email.toLowerCase())) return fail("You can't suspend an Org Owner's mailbox.", 403);
  try {
    const attr: Record<string, unknown> = {};
    if (b.name !== undefined) attr.name = b.name;
    if (b.quotaGb !== undefined) attr.quota = String(Math.round(b.quotaGb * 1024));
    if (b.active !== undefined) attr.active = b.active ? "1" : "0";
    let temp: string | undefined;
    if (b.password) {
      attr.password = b.password;
      attr.password2 = b.password;
    } else if (b.resetPassword) {
      temp = strongPassword(14);
      attr.password = temp;
      attr.password2 = temp;
      attr.force_pw_update = "1";
    }
    await mailcow.editMailbox(b.email, attr);
    const what = [b.name !== undefined && "name", b.quotaGb !== undefined && `storage ${b.quotaGb} GB`, b.active !== undefined && (b.active ? "reactivated" : "suspended"), (b.password || b.resetPassword) && "password reset"].filter(Boolean).join(", ");
    await audit(org.name, user.email, "Mailboxes", `Mailbox ${b.email} changed: ${what}`);
    return json({ ok: true, tempPassword: temp });
  } catch (e) {
    return adminFail(e);
  }
});

export const DELETE = adminRoute(async ({ user, org }, req: Request) => {
  const email = (new URL(req.url).searchParams.get("email") || "").toLowerCase();
  if (!org.domains.includes(email.split("@")[1] || "")) return fail("That mailbox is not in your organization.", 403);
  if (config.adminEmails.includes(email) || email === user.email.toLowerCase()) return fail("You can't delete this mailbox here.", 403);
  try {
    await mailcow.deleteMailbox(email);
    if (hasDb()) await q("delete from shared_mailboxes where address = $1", [email]);
    await audit(org.name, user.email, "Mailboxes", `Mailbox ${email} deleted`);
    return json({ ok: true });
  } catch (e) {
    return adminFail(e);
  }
});
