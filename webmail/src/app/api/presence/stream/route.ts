import { authed } from "@/lib/http";
import { boxFor } from "@/lib/shared";
import { hasDb, q } from "@/lib/db";

export const dynamic = "force-dynamic";

type Row = { thread: string; member: string; name: string; started_at: string; at?: string };

/** Live team status for a shared mailbox (?mbox=), pushed as Server-Sent Events every 2 seconds when it changes. */
export const GET = authed(async (user, req: Request) => {
  const box = await boxFor(user, req, "read");
  const enc = new TextEncoder();
  let stop = false;
  req.signal.addEventListener("abort", () => (stop = true));
  const stream = new ReadableStream({
    async start(ctrl) {
      let last = "";
      const end = Date.now() + 5 * 60_000; // the browser reconnects on its own
      while (!stop && Date.now() < end) {
        try {
          if (box.shared && hasDb()) {
            const replying = await q<Row>("select thread, member, name, started_at from presence where mailbox = $1 and beat_at > now() - interval '75 seconds'", [box.email]);
            const replied = await q<Row>("select thread, member, name, at from replies where mailbox = $1 and at > now() - interval '90 days'", [box.email]);
            const payload = JSON.stringify({ replying, replied });
            if (payload !== last) {
              ctrl.enqueue(enc.encode(`data: ${payload}\n\n`));
              last = payload;
            } else ctrl.enqueue(enc.encode(`: ping\n\n`));
          } else ctrl.enqueue(enc.encode(`: idle\n\n`));
        } catch {
          ctrl.enqueue(enc.encode(`: retry\n\n`));
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      ctrl.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
});
