/**
 * RBAC guard. Server-only.
 *
 * Multi-tenant/RBAC is real from day one: a permission check wraps every
 * mutating action even though today only the seeded OWNER exists. Roles are
 * ordered; a required role is satisfied by that role or any stronger one.
 *
 * TODO(multi-tenant): when Postal resources become per-org scoped, extend these
 * checks to also assert the acting user's organization owns the target
 * resource (e.g. the credential/domain belongs to their Postal org mapping).
 */
import "server-only";
import type { Role } from "@prisma/client";
import { getAuthContext, type AuthContext } from "./auth";

const ROLE_RANK: Record<Role, number> = {
  VIEWER: 0,
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
};

export function roleAtLeast(role: Role, minimum: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

export class AuthError extends Error {
  constructor(
    public readonly status: 401 | 403,
    message: string
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/** Require an authenticated user. Throws AuthError(401) otherwise. */
export async function requireAuth(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) throw new AuthError(401, "Not authenticated");
  return ctx;
}

/** Require an authenticated user with at least `minimum` role. */
export async function requireRole(minimum: Role): Promise<AuthContext> {
  const ctx = await requireAuth();
  if (!roleAtLeast(ctx.user.role, minimum)) {
    throw new AuthError(403, `Requires ${minimum} role or higher`);
  }
  return ctx;
}
