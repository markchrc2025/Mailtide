import { authed, fail, json } from "@/lib/http";
import { listCalendars, listEvents } from "@/lib/dav";
import { davFail } from "@/lib/davhttp";

export const dynamic = "force-dynamic";

/** Calendars and the events between start and end (ISO), across all of the person's calendars. */
export const GET = authed(async (user, req: Request) => {
  const u = new URL(req.url);
  const start = new Date(u.searchParams.get("start") || "");
  const end = new Date(u.searchParams.get("end") || "");
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start || end.getTime() - start.getTime() > 62 * 86400000) {
    return fail("Pick a range of up to two months.");
  }
  try {
    const calendars = await listCalendars(user);
    const lists = await Promise.all(calendars.map((c) => listEvents(user, c.href, start, end)));
    return json({ calendars, events: lists.flat() });
  } catch (e) {
    return davFail(e);
  }
});
