import { boxFor } from "@/lib/shared";
import { authed, fail, json } from "@/lib/http";
import { withImap } from "@/lib/imap";
import { loadThread } from "@/lib/message";

export const dynamic = "force-dynamic";

/** The opened message plus the rest of its conversation (open folder, Inbox, Sent), newest first. */
export const GET = authed(async (user, req: Request, ctx: { params: Promise<{ uid: string }> }) => {
  const box = await boxFor(user, req, "read");
  const { uid } = await ctx.params;
  const n = Number(uid);
  if (!Number.isInteger(n) || n <= 0) return fail("Bad message id.");
  const sp = new URL(req.url).searchParams;
  const folder = sp.get("folder") || "INBOX";
  const also = (sp.get("also") || "")
    .split(",")
    .map(Number)
    .filter((x) => Number.isInteger(x) && x > 0)
    .slice(0, 40);
  const out = await withImap(box, (c) => loadThread(c, folder, n, also));
  if (!out) return fail("That message is gone. It may have been moved or deleted.", 404);
  return json({ subject: out.opened.subject, opened: { uid: out.opened.uid, folder: out.opened.folder }, messages: out.messages });
});
