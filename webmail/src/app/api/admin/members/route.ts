import { z } from "zod";
import { fail, json } from "@/lib/http";
import { adminRoute, audit, roleOf, ROLES } from "@/lib/org";
import { hasMailcow, mailcow } from "@/lib/mailcow";
import { hasDb, q } from "@/lib/db";
import { config } from "@/lib/config";
import { adminFail } from "@/lib/adminhttp";

export const dynamic = "force-dynamic";

export const GET = adminRoute(async ({ org }) => {
  try {
    const shared = hasDb() ? (await q<{ address: string }>("select address from shared_mailboxes where org = $1", [org.name])).map((r) => r.address) : [];
    const boxes = hasMailcow() ? (await Promise.all(org.domains.map((d) => mailcow.mailboxes(d).catch(() => [])))).flat() : [];
    const members = await Promise.all(
      boxes
        .filter((b) => !shared.includes(b.username))
        .map(async (b) => ({ email: b.username, name: b.name, role: await roleOf(b.username), active: String(b.active) === "1", owner: config.adminEmails.includes(b.username.toLowerCase()) })),
    );
    const invites = hasDb() ? await q("select email, mailbox, role, invited_by, created_at, expires_at from invites where org = $1 and accepted_at is null and expires_at > now() order by created_at desc", [org.name]) : [];
    return json({ members, invites });
  } catch (e) {
    return adminFail(e);
  }
});

const Body = z.object({ member: z.string().email(), role: z.enum(ROLES as [string, ...string[]]) });

/** Changes a member's role. Only Org Owners can make or unmake Org Owners. */
export const POST = adminRoute(async ({ user, org, role }, req: Request) => {
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("Pick a member and a role.");
  const { member, role: next } = p.data;
  const m = member.toLowerCase();
  if (!org.domains.includes(m.split("@")[1])) return fail("That person is not in your organization.", 403);
  const cur = await roleOf(m);
  if ((next === "Org Owner" || cur === "Org Owner") && role !== "Org Owner") return fail("Only Org Owners can add or change Org Owners.", 403);
  if (config.adminEmails.includes(m) && next !== "Org Owner") return fail("This Org Owner is set on the server and can't be changed here.", 403);
  if (!hasDb()) return fail("The admin database is not connected yet.", 503);
  try {
    await q("insert into roles (org, member, role) values ($1, $2, $3) on conflict (org, member) do update set role = excluded.role", [org.name, m, next]);
    await audit(org.name, user.email, "Members", `Role of ${m} changed from ${cur} to ${next}`);
    return json({ ok: true });
  } catch (e) {
    return adminFail(e);
  }
});
