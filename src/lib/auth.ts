/**
 * Session auth: single-admin-password login now, multi-user ready.
 * Server-only.
 *
 * - The browser holds an opaque random token in an httpOnly cookie.
 * - The DB stores only sha256(SESSION_SECRET + token), so a DB leak yields no
 *   usable session tokens, and rotating SESSION_SECRET invalidates all sessions.
 */
import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import type { Role, User, Organization } from "@prisma/client";
import { prisma } from "./db";
import { env } from "./env";

export const SESSION_COOKIE = "mailtide_session";
const SESSION_TTL_DAYS = 30;

export interface AuthContext {
  user: User;
  organization: Organization;
}

function hashToken(token: string): string {
  return createHash("sha256").update(`${env.sessionSecret}:${token}`).digest("hex");
}

/** Verify email + password against the seeded user. Returns the user or null. */
export async function verifyCredentials(
  email: string,
  password: string
): Promise<User | null> {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
  if (!user) {
    // Constant-ish work to blunt user enumeration timing.
    await bcrypt.compare(password, "$2a$12$0000000000000000000000000000000000000000000000000000a");
    return null;
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  return ok ? user : null;
}

/** Create a session row and return the raw token to put in the cookie. */
export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: { tokenHash: hashToken(token), userId, expiresAt },
  });
  return { token, expiresAt };
}

/** Look up the current session from the cookie. Null if missing/expired. */
export async function getAuthContext(): Promise<AuthContext | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { organization: true } } },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    // Best-effort cleanup of the expired row.
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  return { user: session.user, organization: session.user.organization };
}

/** Destroy the session matching a raw token (used by logout). */
export async function destroySessionByToken(token: string): Promise<void> {
  await prisma.session
    .deleteMany({ where: { tokenHash: hashToken(token) } })
    .catch(() => {});
}

export const sessionCookieOptions = {
  httpOnly: true as const,
  sameSite: "lax" as const,
  path: "/",
  // Secure in production (served over HTTPS behind Caddy).
  secure: process.env.NODE_ENV === "production",
  maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
};

export type { Role };
