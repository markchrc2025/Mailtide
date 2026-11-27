import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import OrgExplorer from "@/components/OrgExplorer";
import { BUILD } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function OrgPage() {
  if (!(await requireUser())) redirect("/login");
  return <OrgExplorer build={BUILD} />;
}
