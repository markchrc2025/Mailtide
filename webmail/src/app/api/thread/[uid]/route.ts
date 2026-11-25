import { authed, fail, json } from "@/lib/http";
import { withImap } from "@/lib/imap";
import { loadThread } from "@/lib/message";

export const dynamic = "force-dynamic";

/** The opened message plus the rest of its conversation (open folder, Inbox, Sent), newest first. */
export const GET = authed(async (user, req: Request, ctx: { params: Promise<{ uid: string }> }) => {
  const { uid } = await ctx.params;
  const n = Number(uid);
  if (!Number.isInteger(n) || n <= 0) return fail("Bad message id.");
  const folder = new URL(req.url).searchParams.get("folder") || "INBOX";
  const out = await withImap(user, (c) => loadThread(c, folder, n));
  if (!out) return fail("That message is gone. It may have been moved or deleted.", 404);
  return json({ subject: out.opened.subject, opened: { uid: out.opened.uid, folder: out.opened.folder }, messages: out.messages });
});
