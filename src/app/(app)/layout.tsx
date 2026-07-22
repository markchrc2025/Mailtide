import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { AppNav } from "@/components/app-nav";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <AppNav email={ctx.user.email} role={ctx.user.role} />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">{children}</div>
      </main>
    </div>
  );
}
