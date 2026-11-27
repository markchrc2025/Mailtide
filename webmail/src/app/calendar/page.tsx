import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import CalendarApp from "@/components/CalendarApp";
import { BUILD } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  if (!(await requireUser())) redirect("/login");
  return <CalendarApp build={BUILD} />;
}
