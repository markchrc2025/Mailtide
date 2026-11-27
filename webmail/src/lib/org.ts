// Organizations and roles, until Sentire Cloud holds them (P3A). An organization is
// known by its mail domains; Org Owners come from ADMIN_EMAILS, other roles from the database.
import { config } from "./config";
import { hasDb, q } from "./db";
import { authed, fail } from "./http";

export type Role = "Org Owner" | "Org Admin" | "Billing Manager" | "Developer" | "Member";
export const ROLES: Role[] = ["Org Owner", "Org Admin", "Billing Manager", "Developer", "Member"];

const ORG_DOMAINS: Record<string, string[]> = (() => {
  try {
    if (process.env.ORG_DOMAINS) return JSON.parse(process.env.ORG_DOMAINS);
  } catch {
    /* fall back to the default below */
  }
  return { "Sentire Solutions": ["sentire.solutions", "mail.sentire.solutions", "mailtide.sentire.solutions"] };
})();

export type Org = { name: string; domains: string[] };

export function orgOf(email: string): Org {
  const d = email.split("@")[1]?.toLowerCase() || "";
  for (const [name, domains] of Object.entries(ORG_DOMAINS)) if (domains.includes(d)) return { name, domains };
  return { name: config.orgNames[d] || d, domains: [d] };
}

export async function roleOf(email: string): Promise<Role> {
  const e = email.toLowerCase();
  if (config.adminEmails.includes(e)) return "Org Owner";
  if (!hasDb()) return "Member";
  try {
    const r = await q<{ role: Role }>("select role from roles where org = $1 and member = $2", [orgOf(e).name, e]);
    return r[0]?.role || "Member";
  } catch {
    return "Member";
  }
}

export const isAdminRole = (r: Role) => r === "Org Owner" || r === "Org Admin";

type User = { email: string; password: string; name?: string };
export type AdminCtx = { user: User; org: Org; role: Role };

/** Admin API routes: signed in, and Org Owner or Org Admin of their organization (checked on the server). */
export function adminRoute<A extends unknown[]>(fn: (ctx: AdminCtx, ...args: A) => Promise<Response>) {
  return authed<A>(async (user, ...args) => {
    const role = await roleOf(user.email);
    if (!isAdminRole(role)) return fail("Only organization admins can do that.", 403);
    return fn({ user, org: orgOf(user.email), role }, ...args);
  });
}

export async function audit(org: string, actor: string, area: string, action: string, detail: Record<string, unknown> = {}) {
  if (!hasDb()) return;
  try {
    await q("insert into audit (org, actor, area, action, detail) values ($1, $2, $3, $4, $5)", [org, actor, area, action, JSON.stringify(detail)]);
  } catch (e) {
    console.error("[mailtide] audit", (e as Error).message);
  }
}
