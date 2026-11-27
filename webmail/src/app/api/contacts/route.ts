import { z } from "zod";
import { authed, fail, json } from "@/lib/http";
import { deleteContact, listContacts, saveContact } from "@/lib/dav";
import { davFail } from "@/lib/davhttp";

export const dynamic = "force-dynamic";

const Typed = z.array(z.object({ type: z.string().max(20).default(""), value: z.string().trim().max(254) })).max(10).default([]);
const Body = z.object({
  href: z.string().max(500).optional(),
  uid: z.string().max(200).optional(),
  first: z.string().trim().max(200).default(""),
  last: z.string().trim().max(200).default(""),
  emails: Typed,
  phones: Typed,
  company: z.string().trim().max(200).default(""),
  title: z.string().trim().max(200).default(""),
  notes: z.string().max(5000).default(""),
  categories: z.array(z.string().trim().max(50)).max(20).default([]),
  favorite: z.boolean().default(false),
});

export const GET = authed(async (user) => {
  try {
    return json({ contacts: await listContacts(user) });
  } catch (e) {
    return davFail(e);
  }
});

async function save(user: { email: string; password: string }, req: Request) {
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("The contact could not be read.");
  const b = p.data;
  const emails = b.emails.filter((e) => e.value);
  if (emails.some((e) => !z.string().email().safeParse(e.value).success)) return fail("One of the email addresses is not valid.");
  if (!b.first && !b.last && !emails.length && !b.company) return fail("Add a name or an email address.");
  try {
    const out = await saveContact(user, { ...b, emails }, b.href && b.uid ? { href: b.href, uid: b.uid } : undefined);
    return json({ ok: true, ...out });
  } catch (e) {
    return davFail(e);
  }
}

export const POST = authed(async (user, req: Request) => save(user, req));
export const PUT = authed(async (user, req: Request) => save(user, req));

export const DELETE = authed(async (user, req: Request) => {
  const href = new URL(req.url).searchParams.get("href") || "";
  if (!href) return fail("Which contact?");
  try {
    await deleteContact(user, href);
    return json({ ok: true });
  } catch (e) {
    return davFail(e);
  }
});
