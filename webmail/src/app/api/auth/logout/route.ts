import { getSession } from "@/lib/session";
import { json } from "@/lib/http";

export async function POST() {
  const s = await getSession();
  s.destroy();
  return json({ ok: true });
}
