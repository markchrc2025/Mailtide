import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { isAdminRole, roleOf } from "@/lib/org";
import AdminApp from "@/components/AdminApp";
import { BUILD } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const user = await requireUser();
  if (!user) redirect("/login");
  if (!isAdminRole(await roleOf(user.email))) redirect("/mail");
  return <AdminApp section="home" build={BUILD} />;
}
