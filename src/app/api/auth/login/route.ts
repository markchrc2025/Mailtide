import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyCredentials, createSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  try {
    const user = await verifyCredentials(parsed.data.email, parsed.data.password);
    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }
    const { token } = await createSession(user.id);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Login failed";
    // Surface config problems (e.g. DB unreachable) without leaking internals.
    return NextResponse.json({ error: /database|connect|prisma/i.test(msg) ? "Sign-in is temporarily unavailable (database error)." : "Login failed" }, { status: 500 });
  }
}
