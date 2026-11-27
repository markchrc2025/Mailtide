import { boxFor } from "@/lib/shared";
import { authed, json } from "@/lib/http";
import { withImap } from "@/lib/imap";
import { folderRole, ROLE_LABEL, ROLE_ORDER } from "@/lib/mail";

export const dynamic = "force-dynamic";

export const GET = authed(async (user, req: Request) => {
  const box = await boxFor(user, req, "read");
  const folders = await withImap(box, async (c) => {
    const list = await c.list({ statusQuery: { messages: true, unseen: true } });
    return list
      .filter((f) => !f.flags.has("\\Noselect"))
      .map((f) => {
        const role = folderRole(f.path, f.specialUse);
        return {
          path: f.path,
          name: role !== "other" ? ROLE_LABEL[role] : f.name,
          role,
          unseen: f.status?.unseen ?? 0,
          total: f.status?.messages ?? 0,
        };
      })
      .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.name.localeCompare(b.name));
  });
  return json({ folders });
});
