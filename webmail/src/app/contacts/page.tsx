import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import ContactsApp from "@/components/ContactsApp";
import { BUILD } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  if (!(await requireUser())) redirect("/login");
  return <ContactsApp build={BUILD} />;
}
