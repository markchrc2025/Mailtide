import { z } from "zod";
import { authed, fail, json } from "@/lib/http";
import { boxFor } from "@/lib/shared";
import { hasDb, q } from "@/lib/db";

const Body = z.object({ thread: z.string().min(1).max(300), state: z.enum(["start", "beat", "stop"]) });

/** "I'm replying to this" in a shared mailbox (?mbox=). Start, keep alive every 20 s, stop on send or close. */
export const POST = authed(async (user, req: Request) => {
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("Bad presence update.");
  const box = await boxFor(user, req, "sendas");
  if (!box.shared || !hasDb()) return json({ ok: true });
  const { thread, state } = p.data;
  if (state === "stop") {
    await q("delete from presence where mailbox = $1 and thread = $2 and member = $3", [box.email, thread, user.email]);
  } else {
    await q(
      `insert into presence (mailbox, thread, member, name) values ($1,$2,$3,$4)
       on conflict (mailbox, thread, member) do update set beat_at = now()${state === "start" ? ", started_at = now()" : ""}`,
      [box.email, thread, user.email, user.name || user.email.split("@")[0]],
    );
  }
  return json({ ok: true });
});
