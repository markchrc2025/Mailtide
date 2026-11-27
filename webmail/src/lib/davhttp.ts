import { DavError } from "./dav";
import { fail } from "./http";

/** Turns calendar and contact errors into clear answers. */
export function davFail(e: unknown) {
  if (e instanceof DavError) return fail(e.message, e.status === 401 ? 401 : e.status === 403 ? 403 : 502);
  console.error("[mailtide] dav", (e as Error).message);
  return fail("The calendar and contacts server did not answer. Please try again.", 502);
}
