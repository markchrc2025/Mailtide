import { boxFor } from "@/lib/shared";
import { z } from "zod";
import { authed, fail, json } from "@/lib/http";
import { withFolder, withImap } from "@/lib/imap";
import { folderFor } from "@/lib/folders";
import { folderRole } from "@/lib/mail";

const Body = z.object({
  folder: z.string().min(1).max(300),
  uids: z.array(z.number().int().positive()).min(1).max(500),
  action: z.enum(["read", "unread", "flag", "unflag", "archive", "trash", "spam", "notspam", "move"]),
  target: z.string().min(1).max(300).optional(),
});

export const POST = authed(async (user, req: Request) => {
  const box = await boxFor(user, req, (await req.clone().json().catch(() => ({})))?.action === "trash" ? "full" : "read");
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("That action is not valid.");
  const { folder, uids, action, target } = parsed.data;
  const set = uids.join(",");

  // Work out where a move should go before locking the folder.
  let dest: string | null = null;
  if (["archive", "trash", "spam", "notspam", "move"].includes(action)) {
    dest = await withImap(box, async (c) => {
      if (action === "move") return target ?? null;
      if (action === "notspam") return "INBOX";
      const list = await c.list();
      const current = list.find((f) => f.path === folder);
      const role = current ? folderRole(current.path, current.specialUse) : "other";
      if (action === "trash" && role === "trash") return "__delete__";
      return folderFor(c, action === "archive" ? "archive" : action === "trash" ? "trash" : "junk");
    });
    if (!dest) return fail("Choose a folder to move to.");
  }

  await withFolder(box, folder, async (c) => {
    switch (action) {
      case "read":
        await c.messageFlagsAdd(set, ["\\Seen"], { uid: true });
        break;
      case "unread":
        await c.messageFlagsRemove(set, ["\\Seen"], { uid: true });
        break;
      case "flag":
        await c.messageFlagsAdd(set, ["\\Flagged"], { uid: true });
        break;
      case "unflag":
        await c.messageFlagsRemove(set, ["\\Flagged"], { uid: true });
        break;
      default:
        if (dest === "__delete__") await c.messageDelete(set, { uid: true });
        else if (dest && dest !== folder) await c.messageMove(set, dest, { uid: true });
    }
  });
  return json({ ok: true, action, moved: dest && dest !== "__delete__" ? dest : null, deleted: dest === "__delete__" });
});
