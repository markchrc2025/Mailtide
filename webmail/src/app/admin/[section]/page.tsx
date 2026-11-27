import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { isAdminRole, roleOf } from "@/lib/org";
import AdminApp, { type Section } from "@/components/AdminApp";
import { BUILD } from "@/lib/config";

export const dynamic = "force-dynamic";

const SECTIONS: Section[] = ["users", "mailboxes", "shared", "domains", "audit", "billing"];

export default async function AdminSection({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!SECTIONS.includes(section as Section)) notFound();
  const user = await requireUser();
  if (!user) redirect("/login");
  if (!isAdminRole(await roleOf(user.email))) redirect("/mail");
  return <AdminApp section={section as Section} build={BUILD} />;
}
