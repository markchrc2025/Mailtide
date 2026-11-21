import type { ImapFlow } from "imapflow";
import { folderRole, type Role } from "./mail";

const DEFAULT_NAME: Partial<Record<Role, string>> = {
  sent: "Sent",
  drafts: "Drafts",
  trash: "Trash",
  archive: "Archive",
  junk: "Junk",
};

/** Finds the folder for a role (Sent, Drafts, Trash, Archive), creating it if it is missing. */
export async function folderFor(c: ImapFlow, role: Role): Promise<string> {
  const list = await c.list();
  const hit = list.find((f) => folderRole(f.path, f.specialUse) === role);
  if (hit) return hit.path;
  const name = DEFAULT_NAME[role];
  if (!name) throw new Error(`No folder for ${role}`);
  await c.mailboxCreate(name);
  return name;
}
