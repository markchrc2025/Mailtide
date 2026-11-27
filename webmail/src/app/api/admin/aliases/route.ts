import { z } from "zod";
import { fail, json } from "@/lib/http";
import { adminRoute, audit } from "@/lib/org";
import { mailcow } from "@/lib/mailcow";
import { adminFail } from "@/lib/adminhttp";

export const dynamic = "force-dynamic";

const RESERVED = ["admin", "postmaster", "abuse", "security", "support", "billing", "no-reply", "noreply", "sentire", "mailtide", "root", "hostmaster", "webmaster"];
const SHARED_DOMAINS = ["mail.sentire.solutions", "mailtide.sentire.solutions"];

export const GET = adminRoute(async ({ org }) => {
  try {
    const all = await mailcow.aliases();
    return json({ aliases: all.filter((a) => org.domains.includes(a.domain)).map((a) => ({ id: a.id, address: a.address, goto: a.goto.split(",").filter(Boolean), active: String(a.active) === "1" })) });
  } catch (e) {
    return adminFail(e);
  }
});

const Body = z.object({ local: z.string().trim().regex(/^[a-z0-9._-]{1,64}$/i, "Use letters, numbers, dots, dashes or underscores."), domain: z.string(), goto: z.array(z.string().email()).min(1).max(20) });

export const POST = adminRoute(async ({ user, org }, req: Request) => {
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail(p.error.issues[0]?.message || "Check the alias.");
  const b = p.data;
  if (!org.domains.includes(b.domain)) return fail("Pick one of your organization's domains.", 403);
  if (SHARED_DOMAINS.includes(b.domain) && RESERVED.includes(b.local.toLowerCase())) return fail(`${b.local}@ is reserved on shared domains.`, 403);
  try {
    const address = `${b.local.toLowerCase()}@${b.domain}`;
    await mailcow.addAlias(address, b.goto.join(","));
    await audit(org.name, user.email, "Aliases", `Alias ${address} created, delivers to ${b.goto.join(", ")}`);
    return json({ ok: true });
  } catch (e) {
    return adminFail(e);
  }
});

export const DELETE = adminRoute(async ({ user, org }, req: Request) => {
  const id = Number(new URL(req.url).searchParams.get("id"));
  try {
    const a = (await mailcow.aliases()).find((x) => x.id === id);
    if (!a || !org.domains.includes(a.domain)) return fail("That alias is not in your organization.", 403);
    await mailcow.deleteAlias(id);
    await audit(org.name, user.email, "Aliases", `Alias ${a.address} deleted`);
    return json({ ok: true });
  } catch (e) {
    return adminFail(e);
  }
});
