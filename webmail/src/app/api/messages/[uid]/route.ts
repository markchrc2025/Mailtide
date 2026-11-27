import { boxFor } from "@/lib/shared";
import { authed, fail, json } from "@/lib/http";
import { withFolder } from "@/lib/imap";
import { parseOne } from "@/lib/message";

export const dynamic = "force-dynamic";

export const GET = authed(async (user, req: Request, ctx: { params: Promise<{ uid: string }> }) => {
  const box = await boxFor(user, req, "read");
  const { uid } = await ctx.params;
  const n = Number(uid);
  if (!Number.isInteger(n) || n <= 0) return fail("Bad message id.");
  const folder = new URL(req.url).searchParams.get("folder") || "INBOX";
  const out = await withFolder(box, folder, (c) => parseOne(c, folder, n, true));
  if (!out) return fail("That message is gone. It may have been moved or deleted.", 404);
  return json(out);
});
