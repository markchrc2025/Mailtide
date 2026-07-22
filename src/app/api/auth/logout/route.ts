import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, destroySessionByToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) await destroySessionByToken(token);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
