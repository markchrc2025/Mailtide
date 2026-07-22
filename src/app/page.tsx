import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const ctx = await getAuthContext();
  redirect(ctx ? "/domains" : "/login");
}
