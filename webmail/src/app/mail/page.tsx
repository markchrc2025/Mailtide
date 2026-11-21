import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import MailApp from "@/components/MailApp";
import { BUILD } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function MailPage() {
  const user = await requireUser();
  if (!user) redirect("/login");
  return <MailApp email={user.email} build={BUILD} />;
}
