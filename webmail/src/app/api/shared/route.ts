import { authed, json } from "@/lib/http";
import { sharedFor } from "@/lib/shared";

export const dynamic = "force-dynamic";

/** The shared mailboxes the signed-in person belongs to, for the folder pane and the From picker. */
export const GET = authed(async (user) => json({ shared: await sharedFor(user.email).catch(() => []) }));
