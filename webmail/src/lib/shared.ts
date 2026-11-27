// Shared mailboxes: a normal mailcow mailbox nobody signs in to. MailTide keeps its
// password sealed and opens it for members, with Read, Send as or Full access.
import { hasDb, q } from "./db";
import { unseal } from "./secret";
import { mailcow } from "./mailcow";

export type Access = "read" | "sendas" | "full";
export type SharedBox = { address: string; name: string; access: Access; options: { saveSent?: boolean; showReplying?: boolean; sentByLine?: boolean } };

export async function sharedFor(member: string): Promise<SharedBox[]> {
  if (!hasDb()) return [];
  return q<SharedBox>(
    "select s.address, s.name, m.access, s.options from shared_members m join shared_mailboxes s on s.address = m.address where m.member = $1 order by s.name",
    [member.toLowerCase()],
  );
}

type Creds = { email: string; password: string; name?: string };

/** The mailbox a request works on: the person's own, or a shared one they belong to (?mbox=). */
export async function boxFor(user: Creds, req: Request, need: Access = "read"): Promise<Creds & { shared?: SharedBox }> {
  const mbox = (new URL(req.url).searchParams.get("mbox") || "").toLowerCase();
  if (!mbox || mbox === user.email.toLowerCase()) return user;
  const rows = hasDb()
    ? await q<{ secret: string; name: string; access: Access; options: SharedBox["options"] }>(
        "select s.secret, s.name, m.access, s.options from shared_members m join shared_mailboxes s on s.address = m.address where m.address = $1 and m.member = $2",
        [mbox, user.email.toLowerCase()],
      )
    : [];
  const r = rows[0];
  const rank = { read: 0, sendas: 1, full: 2 };
  if (!r || rank[r.access] < rank[need]) {
    const err = new Error("You don't have access to that shared mailbox.") as Error & { status?: number };
    err.status = 403;
    throw err;
  }
  return { email: mbox, password: unseal(r.secret), name: r.name, shared: { address: mbox, name: r.name, access: r.access, options: r.options } };
}

/** Recomputes which shared addresses a member may send as, in mailcow (Send as or Full). */
export async function syncSendAs(member: string) {
  const rows = await q<{ address: string }>("select address from shared_members where member = $1 and access in ('sendas','full')", [member.toLowerCase()]);
  await mailcow.editMailbox(member, { sender_acl: rows.map((r) => r.address) });
}
