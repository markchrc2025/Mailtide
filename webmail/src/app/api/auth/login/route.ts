import { z } from "zod";
import { getSession } from "@/lib/session";
import { verifyLogin } from "@/lib/imap";
import { fail, json } from "@/lib/http";

const Body = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(512),
  remember: z.boolean().optional(),
});

// Simple in-memory brake on password guessing: 8 tries per 10 minutes per address.
const g = globalThis as unknown as { __mtTries?: Map<string, number[]> };
const tries: Map<string, number[]> = (g.__mtTries ??= new Map());

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Enter your email address and password.");
  const { email, password, remember } = parsed.data;

  const now = Date.now();
  const recent = (tries.get(email) ?? []).filter((t) => now - t < 10 * 60_000);
  if (recent.length >= 8) return fail("Too many attempts. Wait 10 minutes and try again.", 429);

  let ok = false;
  try {
    ok = await verifyLogin({ email, password });
  } catch (e) {
    console.error("[mailtide] login", (e as Error).message);
    return fail("We could not reach the mail server. Please try again in a minute.", 502);
  }
  if (!ok) {
    recent.push(now);
    tries.set(email, recent);
    return fail("That email address or password is not right.", 401);
  }
  tries.delete(email);

  const session = await getSession(!!remember);
  session.email = email;
  session.password = password;
  await session.save();
  return json({ ok: true, email });
}
