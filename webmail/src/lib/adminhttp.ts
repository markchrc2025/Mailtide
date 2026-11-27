import { MailcowError } from "./mailcow";
import { fail } from "./http";

export function adminFail(e: unknown) {
  if (e instanceof MailcowError) return fail(e.message, e.status);
  const m = (e as Error).message || "";
  if (/DATABASE_URL/.test(m)) return fail("The admin database is not connected yet.", 503);
  console.error("[mailtide] admin", m);
  return fail("Something went wrong. Please try again.", 500);
}
