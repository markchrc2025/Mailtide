import { NextResponse } from "next/server";
import { requireUser } from "./session";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function fail(message: string, status = 400) {
  return json({ error: message }, status);
}

type User = { email: string; password: string; name?: string };

/** Wraps a route handler: requires a signed-in user and turns errors into JSON. */
export function authed<A extends unknown[]>(fn: (user: User, ...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    const user = await requireUser();
    if (!user) return fail("Please sign in again.", 401);
    try {
      return await fn(user, ...args);
    } catch (e) {
      const err = e as { authenticationFailed?: boolean; message?: string; responseText?: string };
      if (err.authenticationFailed) return fail("Your password was changed. Please sign in again.", 401);
      console.error("[mailtide]", err.message, err.responseText ?? "");
      return fail("The mail server did not answer. Please try again.", 502);
    }
  };
}
