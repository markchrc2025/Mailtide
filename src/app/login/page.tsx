import { redirect } from "next/navigation";
import { Waves } from "lucide-react";
import { getAuthContext } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const ctx = await getAuthContext();
  if (ctx) redirect("/domains");

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Waves className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">MailTide</h1>
          <p className="text-sm text-muted-foreground">Sign in to your Postal console.</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
