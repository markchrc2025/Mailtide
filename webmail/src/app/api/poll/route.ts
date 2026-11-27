import { boxFor } from "@/lib/shared";
import { authed, json } from "@/lib/http";
import { withImap } from "@/lib/imap";

export const dynamic = "force-dynamic";

// Light check the app runs every 30 seconds to notice new mail.
export const GET = authed(async (user, req: Request) => {
  const box = await boxFor(user, req, "read");
  const folder = new URL(req.url).searchParams.get("folder") || "INBOX";
  const s = await withImap(box, (c) => c.status(folder, { messages: true, unseen: true, uidNext: true }));
  return json({ folder, total: s.messages ?? 0, unseen: s.unseen ?? 0, uidNext: s.uidNext ?? 0 });
});
