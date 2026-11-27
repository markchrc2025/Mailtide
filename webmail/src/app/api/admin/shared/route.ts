import { z } from "zod";
import { fail, json } from "@/lib/http";
import { adminRoute, audit } from "@/lib/org";
import { mailcow } from "@/lib/mailcow";
import { hasDb, q } from "@/lib/db";
import { seal, strongPassword } from "@/lib/secret";
import { syncSendAs } from "@/lib/shared";
import { adminFail } from "@/lib/adminhttp";

export const dynamic = "force-dynamic";

const Member = z.object({ email: z.string().email(), access: z.enum(["read", "sendas", "full"]) });
const Options = z.object({ saveSent: z.boolean().default(true), showReplying: z.boolean().default(true), sentByLine: z.boolean().default(false) });

export const GET = adminRoute(async ({ org }) => {
  if (!hasDb()) return json({ shared: [] });
  try {
    const boxes = await q<{ address: string; name: string; options: unknown; created_at: string }>("select address, name, options, created_at from shared_mailboxes where org = $1 order by name", [org.name]);
    const members = await q<{ address: string; member: string; access: string }>("select address, member, access from shared_members where address = any($1)", [boxes.map((b) => b.address)]);
    return json({ shared: boxes.map((b) => ({ ...b, members: members.filter((m) => m.address === b.address).map((m) => ({ email: m.member, access: m.access })) })) });
  } catch (e) {
    return adminFail(e);
  }
});

const Create = z.object({
  local: z.string().trim().regex(/^[a-z0-9._-]{1,64}$/i, "Use letters, numbers, dots, dashes or underscores in the address."),
  domain: z.string(),
  name: z.string().trim().min(1, "Give it a display name.").max(120),
  members: z.array(Member).min(1, "Add at least one person.").max(100),
  options: Options.default({}),
});

async function setMembers(address: string, members: z.infer<typeof Member>[]) {
  const before = (await q<{ member: string }>("select member from shared_members where address = $1", [address])).map((r) => r.member);
  await q("delete from shared_members where address = $1", [address]);
  for (const m of members) await q("insert into shared_members (address, member, access) values ($1, $2, $3)", [address, m.email.toLowerCase(), m.access]);
  const touched = [...new Set([...before, ...members.map((m) => m.email.toLowerCase())])];
  for (const t of touched) await syncSendAs(t).catch((e) => console.error("[mailtide] sender_acl", t, (e as Error).message));
}

export const POST = adminRoute(async ({ user, org }, req: Request) => {
  const p = Create.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail(p.error.issues[0]?.message || "Check the shared mailbox details.");
  const b = p.data;
  if (!hasDb()) return fail("The admin database is not connected yet.", 503);
  if (!org.domains.includes(b.domain)) return fail("Pick one of your organization's domains.", 403);
  if (b.members.some((m) => !org.domains.includes(m.email.split("@")[1]))) return fail("Members must be people in your organization.", 403);
  const address = `${b.local.toLowerCase()}@${b.domain}`;
  try {
    const password = strongPassword();
    await mailcow.addMailbox({ local_part: b.local.toLowerCase(), domain: b.domain, name: b.name, password, quotaMb: 5120 });
    await q("insert into shared_mailboxes (address, org, name, secret, options) values ($1,$2,$3,$4,$5)", [address, org.name, b.name, seal(password), JSON.stringify(b.options)]);
    await setMembers(address, b.members);
    await audit(org.name, user.email, "Shared mailboxes", `Shared mailbox ${address} created; ${b.members.length} member(s)`);
    return json({ ok: true, address });
  } catch (e) {
    return adminFail(e);
  }
});

const Edit = z.object({ address: z.string().email(), name: z.string().trim().min(1).max(120).optional(), members: z.array(Member).min(1).max(100).optional(), options: Options.optional() });

export const PATCH = adminRoute(async ({ user, org }, req: Request) => {
  const p = Edit.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("Check the changes.");
  const b = p.data;
  try {
    const own = await q("select 1 from shared_mailboxes where address = $1 and org = $2", [b.address, org.name]);
    if (!own.length) return fail("That shared mailbox is not in your organization.", 403);
    if (b.members && b.members.some((m) => !org.domains.includes(m.email.split("@")[1]))) return fail("Members must be people in your organization.", 403);
    if (b.name) {
      await q("update shared_mailboxes set name = $2 where address = $1", [b.address, b.name]);
      await mailcow.editMailbox(b.address, { name: b.name });
    }
    if (b.options) await q("update shared_mailboxes set options = $2 where address = $1", [b.address, JSON.stringify(b.options)]);
    if (b.members) await setMembers(b.address, b.members);
    await audit(org.name, user.email, "Shared mailboxes", `Shared mailbox ${b.address} changed${b.members ? `; ${b.members.length} member(s)` : ""}`);
    return json({ ok: true });
  } catch (e) {
    return adminFail(e);
  }
});
