"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Globe, KeyRound, ScrollText, LogOut, Waves } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/domains", label: "Domains", icon: Globe },
  { href: "/credentials", label: "API Keys", icon: KeyRound },
  { href: "/send-log", label: "Send Log", icon: ScrollText },
];

export function AppNav({ email, role }: { email: string; role: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = React.useState(false);

  async function logout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <aside className="flex w-full flex-col gap-6 border-b border-border bg-card px-4 py-4 md:h-screen md:w-64 md:border-b-0 md:border-r md:px-4 md:py-6">
      <div className="flex items-center gap-2 px-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Waves className="h-5 w-5" />
        </div>
        <span className="text-lg font-semibold tracking-tight">MailTide</span>
      </div>

      <nav className="flex flex-row gap-1 md:flex-1 md:flex-col">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="hidden flex-col gap-3 border-t border-border px-2 pt-4 md:flex">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{email}</p>
          <p className="text-xs text-muted-foreground">{role}</p>
        </div>
        <Button variant="outline" size="sm" onClick={logout} disabled={loggingOut}>
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
