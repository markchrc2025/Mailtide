"use client";
// The Outlook-style frame shared by Mail, Calendar, Contacts and Org Explorer:
// top bar (app launcher, search, notifications, settings, help, account) and the app rail.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ADMIN_CONSOLE_READY, APPS } from "@/lib/apps";
import { GLYPHS } from "@/lib/glyphs";
import { api } from "@/lib/client";
import { LogoMark } from "./Logo";
import {
  AddPerson,
  Bell,
  Calendar,
  Close,
  Contacts,
  External,
  Gear,
  Help,
  Mail,
  More,
  OrgChart,
  Search,
  Shield,
  Waffle,
} from "./Icons";

export type RailKey = "mail" | "calendar" | "contacts" | "org";

export type SearchProps = {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  placeholder?: string;
};

type Me = { email: string; name?: string; admin?: boolean; org?: string };

export function Tile({ app, size = 44 }: { app: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" className="flex-none">
      <rect width="100" height="100" rx="23.5" fill="#2E241C" />
      <svg x="17" y="17" width="66" height="66" viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: GLYPHS[app] || "" }} />
    </svg>
  );
}

function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

const initialsOf = (name: string, email: string) => {
  const src = (name || email.split("@")[0]).replace(/[._-]+/g, " ").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || parts[0]?.[1] || "")).toUpperCase();
};

type Panel = null | "apps" | "account" | "help" | "settings" | "bell";

export function TopBar({
  product = "MailTide",
  search,
  unread = 0,
  build,
  settings,
}: {
  product?: string;
  search?: SearchProps;
  unread?: number;
  build?: string;
  settings?: React.ReactNode;
}) {
  const [panel, setPanel] = useState<Panel>(null);
  const [me, setMe] = useState<Me | null>(null);
  const close = () => setPanel(null);
  const ref = useOutside(panel !== null, close);
  const toggle = (p: Panel) => setPanel((cur) => (cur === p ? null : p));

  useEffect(() => {
    api<Me>("/api/me").then(setMe).catch(() => null);
  }, []);

  async function signOut(to = "/login") {
    await api("/api/auth/logout", { method: "POST" }).catch(() => null);
    window.location.href = to;
  }

  const email = me?.email || "";
  const name = me?.name || "";
  const ini = email ? initialsOf(name, email) : "";
  const iconBtn = "flex h-10 w-10 items-center justify-center rounded-lg text-espresso-text hover:bg-white/10";

  return (
    <header ref={ref} className="relative z-30 flex h-[52px] flex-none items-center gap-2 bg-espresso pl-1 pr-3 text-espresso-text md:gap-3">
      <button aria-label="Sentire apps" aria-expanded={panel === "apps"} onClick={() => toggle("apps")} className={`${iconBtn} h-11 w-11 ${panel === "apps" ? "bg-white/10" : ""}`}>
        <Waffle size={20} />
      </button>
      <Link href="/mail" className="flex items-center gap-2 no-underline">
        <span className="tile flex h-[26px] w-[26px] items-center justify-center rounded-[7px]">
          <LogoMark size={17} />
        </span>
        <b className="hidden font-head text-base font-semibold text-white sm:inline">{product}</b>
      </Link>

      <div className="flex flex-1 justify-center px-1">
        {search && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              search.onSubmit();
            }}
            className="flex h-[34px] w-full max-w-[620px] items-center gap-2 rounded-[9px] bg-bg px-3 text-muted focus-within:ring-2 focus-within:ring-orange"
          >
            <Search size={16} />
            <label htmlFor="mt-search" className="sr-only">
              {search.placeholder || "Search"}
            </label>
            <input
              id="mt-search"
              ref={search.inputRef}
              value={search.value}
              onChange={(e) => search.onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  search.onClear();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              placeholder={search.placeholder || "Search"}
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
            />
            {search.value ? (
              <button type="button" aria-label="Clear search" onClick={search.onClear} className="text-muted hover:text-ink">
                <Close size={15} />
              </button>
            ) : (
              <span className="hidden rounded-md border border-line-strong bg-white px-1.5 font-head text-[11px] font-semibold md:inline">⌘K</span>
            )}
          </form>
        )}
      </div>

      <div className="flex items-center">
        <button aria-label="Notifications" onClick={() => toggle("bell")} className={`${iconBtn} relative hidden sm:flex`}>
          <Bell size={19} />
          {unread > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-orange" aria-hidden="true" />}
        </button>
        {settings && (
          <button aria-label="Settings" onClick={() => toggle("settings")} className={`${iconBtn} hidden sm:flex`}>
            <Gear size={19} />
          </button>
        )}
        <button aria-label="Help" onClick={() => toggle("help")} className={`${iconBtn} hidden sm:flex`}>
          <Help size={19} />
        </button>
        <button
          aria-label={`Account: ${email}`}
          aria-expanded={panel === "account"}
          onClick={() => toggle("account")}
          className={`ml-1.5 flex h-[34px] w-[34px] items-center justify-center rounded-full bg-orange text-[12.5px] font-bold text-white ${panel === "account" ? "ring-2 ring-[#F2ECE4]" : ""}`}
        >
          {ini}
        </button>
      </div>

      {panel === "apps" && (
        <div role="dialog" aria-label="Sentire apps" className="absolute left-0 top-[52px] w-[420px] max-w-[100vw] rounded-br-2xl bg-white p-[18px] text-ink shadow-[0_18px_48px_rgba(46,36,28,.22)]">
          <span className="text-xs font-semibold uppercase tracking-[.06em] text-muted">Apps</span>
          <div className="mt-2.5 grid grid-cols-4 gap-1">
            {APPS.map((a) => {
              const cur = a.key === "mailtide";
              const inner = (
                <>
                  <Tile app={a.key} size={48} />
                  <span className="text-center text-[13px] leading-tight">{a.name}</span>
                </>
              );
              const cls = `flex flex-col items-center gap-2 rounded-xl px-1 py-3 text-ink no-underline hover:bg-paper ${cur ? "bg-paper shadow-[inset_0_0_0_2px_#F6D3C2]" : ""}`;
              return a.url.startsWith("/") ? (
                <Link key={a.key} href={a.url} onClick={close} className={cls} title={a.blurb}>
                  {inner}
                </Link>
              ) : (
                <a key={a.key} href={a.url} target="_blank" rel="noopener noreferrer" className={cls} title={a.blurb}>
                  {inner}
                </a>
              );
            })}
          </div>
          {me?.admin && ADMIN_CONSOLE_READY && (
            <>
              <div className="my-3.5 h-px bg-line" />
              <span className="text-xs font-semibold uppercase tracking-[.06em] text-muted">For admins</span>
              <Link href="/admin" onClick={close} className="mt-2.5 flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 text-ink no-underline hover:bg-paper">
                <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-orange-soft text-orange-text">
                  <Shield size={20} />
                </span>
                <span className="flex flex-1 flex-col leading-snug">
                  <b className="text-sm font-semibold">Admin</b>
                  <span className="text-[12.5px] text-muted">Users, mailboxes, domains</span>
                </span>
              </Link>
            </>
          )}
        </div>
      )}

      {panel === "account" && (
        <div role="dialog" aria-label="Account" className="absolute right-0 top-[52px] w-[440px] max-w-[100vw] overflow-hidden rounded-bl-2xl bg-white text-ink shadow-[0_18px_48px_rgba(46,36,28,.22)]">
          <div className="flex items-center gap-3 px-[18px] pb-1 pt-3.5">
            <span className="flex-1 truncate text-sm text-ink-soft">{me?.org || email.split("@")[1] || ""}</span>
            <button onClick={() => signOut()} className="text-sm font-semibold text-orange-text hover:underline">
              Sign out
            </button>
          </div>
          <div className="flex items-center gap-[18px] px-[18px] pb-[18px] pt-3.5">
            <span className="flex h-[88px] w-[88px] flex-none items-center justify-center rounded-full bg-orange font-head text-[30px] font-semibold text-white">{ini}</span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <b className="truncate font-head text-xl font-semibold">{name || email.split("@")[0]}</b>
              <span className="truncate text-sm text-ink-soft">{email}</span>
              <span className="mt-1 text-sm text-muted" title="Your Sentire account page opens here once Sentire Cloud is live.">
                View account <span className="text-xs">(with Sentire Cloud)</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="flex-1 text-sm text-muted" title="Shared mailboxes you can open appear in your folder list.">
                  Open another mailbox <span className="text-xs">(shared mailboxes are in your folder list)</span>
                </span>
                <span className="text-muted" aria-hidden="true">
                  <More size={16} />
                </span>
              </span>
            </div>
          </div>
          <button onClick={() => signOut("/login?switch=1")} className="flex w-full items-center gap-3.5 border-t border-line bg-paper px-[18px] py-3.5 text-left text-sm hover:bg-sand">
            <span className="flex h-10 w-10 items-center justify-center rounded-full border-[1.5px] border-line-strong text-ink-soft">
              <AddPerson size={19} />
            </span>
            Sign in with a different account
          </button>
        </div>
      )}

      {panel === "bell" && (
        <div role="dialog" aria-label="Notifications" className="absolute right-12 top-[52px] w-[320px] rounded-b-2xl bg-white p-4 text-sm text-ink shadow-[0_18px_48px_rgba(46,36,28,.22)]">
          <b className="font-head text-[15px] font-semibold">Notifications</b>
          <p className="mb-0 mt-2 text-ink-soft">
            {unread > 0 ? `${unread} unread ${unread === 1 ? "email" : "emails"} in your Inbox.` : "You're all caught up."}
          </p>
        </div>
      )}

      {panel === "settings" && settings && (
        <div role="dialog" aria-label="Settings" className="absolute right-12 top-[52px] w-[340px] rounded-b-2xl bg-white p-4 text-sm text-ink shadow-[0_18px_48px_rgba(46,36,28,.22)]">
          <b className="font-head text-[15px] font-semibold">Settings</b>
          <div className="mt-3 flex flex-col gap-3">{settings}</div>
        </div>
      )}

      {panel === "help" && (
        <div role="dialog" aria-label="Help" className="absolute right-12 top-[52px] w-[320px] rounded-b-2xl bg-white p-4 text-sm text-ink shadow-[0_18px_48px_rgba(46,36,28,.22)]">
          <b className="font-head text-[15px] font-semibold">Keyboard shortcuts</b>
          <dl className="mt-2.5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
            {[
              ["c", "New email"],
              ["/ or ⌘K", "Search"],
              ["j / k", "Next and previous"],
              ["e", "Archive"],
              ["#", "Delete"],
              ["Esc", "Close"],
            ].map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="font-semibold">{k}</dt>
                <dd className="m-0 text-ink-soft">{v}</dd>
              </div>
            ))}
          </dl>
          {build && <p className="mb-0 mt-3 text-xs text-muted">MailTide {build}</p>}
        </div>
      )}
    </header>
  );
}

export function Rail({ active }: { active: RailKey }) {
  const items: { key: RailKey; label: string; href: string; Icon: (p: { size?: number }) => React.ReactNode }[] = [
    { key: "mail", label: "Mail", href: "/mail", Icon: Mail },
    { key: "calendar", label: "Calendar", href: "/calendar", Icon: Calendar },
    { key: "contacts", label: "Contacts", href: "/contacts", Icon: Contacts },
    { key: "org", label: "Org Explorer", href: "/org", Icon: OrgChart },
  ];
  return (
    <nav aria-label="Apps" className="hidden w-[52px] flex-none flex-col items-center gap-1.5 pt-2.5 sm:flex">
      {items.map(({ key, label, href, Icon }) => (
        <Link
          key={key}
          href={href}
          aria-label={label}
          title={label}
          aria-current={key === active ? "page" : undefined}
          className={`flex h-10 w-10 items-center justify-center rounded-[10px] ${
            key === active ? "bg-white text-orange shadow-[0_1px_2px_rgba(46,36,28,.12)]" : "text-ink-soft hover:bg-white/70"
          }`}
        >
          <Icon size={20} />
        </Link>
      ))}
    </nav>
  );
}

export function Shell({
  active,
  children,
  ...top
}: { active: RailKey; children: React.ReactNode } & Parameters<typeof TopBar>[0]) {
  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-bg">
      <TopBar {...top} />
      <div className="flex min-h-0 flex-1">
        <Rail active={active} />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}

export { External };
