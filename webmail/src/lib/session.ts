import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { sessionSecret } from "./config";

// The session cookie is sealed and encrypted (iron-session, AES-256).
// It holds the mailbox credentials so the server can open IMAP/SMTP
// on each request; the browser can never read them.
export type MailSession = {
  email?: string;
  password?: string;
  name?: string;
};

export function sessionOptions(remember = false): SessionOptions {
  return {
    password: sessionSecret(),
    cookieName: "mailtide_session",
    ttl: remember ? 60 * 60 * 24 * 30 : 60 * 60 * 12,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
  };
}

export async function getSession(remember = false) {
  return getIronSession<MailSession>(await cookies(), sessionOptions(remember));
}

export async function requireUser(): Promise<{ email: string; password: string; name?: string } | null> {
  const s = await getSession();
  if (!s.email || !s.password) return null;
  return { email: s.email, password: s.password, name: s.name };
}
