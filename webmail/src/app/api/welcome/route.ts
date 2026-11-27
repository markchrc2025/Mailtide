import { z } from "zod";
import { fail, json } from "@/lib/http";
import { q, hasDb } from "@/lib/db";
import { mailcow } from "@/lib/mailcow";
import { audit } from "@/lib/org";
import { adminFail } from "@/lib/adminhttp";

export const dynamic = "force-dynamic";

type Invite = { token: string; org: string; email: string; mailbox: string | null; role: string; invited_by: string };

async function find(token: string) {
  if (!hasDb() || !token) return null;
  return (await q<Invite>("select token, org, email, mailbox, role, invited_by from invites where token = $1 and accepted_at is null and expires_at > now()", [token]))[0] || null;
}

/** Public: shows what an invitation is for (no sign-in needed; the token is the proof). */
export async function GET(req: Request) {
  const inv = await find(new URL(req.url).searchParams.get("t") || "").catch(() => null);
  if (!inv) return fail("This invitation has expired or was already used.", 404);
  return json({ org: inv.org, email: inv.email, mailbox: inv.mailbox, role: inv.role, invitedBy: inv.invited_by });
}

const Body = z.object({ t: z.string().min(10), password: z.string().min(10).max(128).optional() });

export async function POST(req: Request) {
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("Choose a password of at least 10 characters.");
  try {
    const inv = await find(p.data.t);
    if (!inv) return fail("This invitation has expired or was already used.", 404);
    if (inv.mailbox && !p.data.password) return fail("Choose a password of at least 10 characters.");
    if (inv.mailbox && p.data.password) await mailcow.editMailbox(inv.mailbox, { password: p.data.password, password2: p.data.password });
    await q("update invites set accepted_at = now() where token = $1", [inv.token]);
    if (inv.role !== "Member") {
      await q("insert into roles (org, member, role) values ($1, $2, $3) on conflict (org, member) do update set role = excluded.role", [inv.org, (inv.mailbox || inv.email).toLowerCase(), inv.role]);
    }
    await audit(inv.org, inv.mailbox || inv.email, "Members", `Accepted the invitation as ${inv.role}`);
    return json({ ok: true, mailbox: inv.mailbox });
  } catch (e) {
    return adminFail(e);
  }
}
