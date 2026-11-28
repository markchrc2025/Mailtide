"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { askConfirm } from "./Dialogs";
import { TopBar } from "./Shell";
import { AddPerson, At, Card, Close, Download, Globe, Home, Log, Mail, People, Plus, Reply, Shield, Trash } from "./Icons";

export type Section = "home" | "users" | "mailboxes" | "shared" | "domains" | "audit" | "billing";

const NAV: { key: Section; label: string; href: string; Icon: (p: { size?: number }) => React.ReactNode }[] = [
  { key: "home", label: "Home", href: "/admin", Icon: Home },
  { key: "users", label: "Users and roles", href: "/admin/users", Icon: People },
  { key: "mailboxes", label: "Mailboxes", href: "/admin/mailboxes", Icon: Mail },
  { key: "shared", label: "Aliases and shared mailboxes", href: "/admin/shared", Icon: At },
  { key: "domains", label: "Domains", href: "/admin/domains", Icon: Globe },
  { key: "audit", label: "Audit log", href: "/admin/audit", Icon: Log },
  { key: "billing", label: "Plan and billing", href: "/admin/billing", Icon: Card },
];
const ROLES = ["Org Owner", "Org Admin", "Billing Manager", "Developer", "Member"] as const;
const ROLE_HELP: Record<string, string> = {
  "Org Owner": "Everything, including closing the org",
  "Org Admin": "Runs mailboxes, aliases, members",
  "Billing Manager": "Plan, payments, invoices",
  Developer: "Postal credentials and sending logs",
  Member: "Uses their own mailbox",
};

const btn = "inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-line-strong bg-white px-3 text-[13.5px] font-semibold text-ink no-underline hover:bg-bg disabled:opacity-50";
const btnP = "inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg bg-orange px-3.5 text-[13.5px] font-semibold text-white no-underline hover:bg-orange-press disabled:opacity-50";
// inpBase has no width, for fields that sit beside others in a row (MTD-102).
const inpBase = "h-[38px] rounded-lg border border-line-strong bg-white px-3 text-sm outline-none focus:border-orange";
const inp = `${inpBase} w-full`;
const lab = "flex flex-col gap-1.5 text-[13.5px] font-semibold";
const th = "whitespace-nowrap border-b border-line px-3 py-2.5 text-left text-xs font-semibold text-muted";
const td = "border-b border-line-faint px-3 py-2.5 align-middle text-[13.5px]";
const gb = (bytes: number) => (bytes >= 1073741824 ? `${(bytes / 1073741824).toFixed(1)} GB` : `${Math.max(0, Math.round(bytes / 1048576))} MB`);
const when = (iso: string) => new Date(iso).toLocaleString("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function Chip({ children, tone = "good" }: { children: React.ReactNode; tone?: "good" | "warn" | "muted" | "blue" }) {
  const c = { good: "bg-[#E4F0E6] text-[#2C6B3A]", warn: "bg-orange-soft text-orange-text", muted: "bg-sand text-ink-soft", blue: "bg-[#DDE7F3] text-[#2F5B8A]" }[tone];
  return <span className={`inline-block whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold ${c}`}>{children}</span>;
}

function CardBox({ title, icon, action, children }: { title: string; icon: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-3.5 rounded-[14px] border border-line bg-white p-[18px]">
      <div className="flex items-center gap-2.5">
        <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[9px] bg-sand text-ink-soft">{icon}</span>
        <h2 className="m-0 flex-1 font-head text-base font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Person({ name, email, initials, dark }: { name: string; email: string; initials: string; dark?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span className={`flex h-8 w-8 flex-none items-center justify-center rounded-full text-[11.5px] font-bold ${dark ? "bg-espresso text-[#F2ECE4]" : "bg-orange text-white"}`}>{initials}</span>
      <span className="flex min-w-0 flex-col leading-tight">
        <b className="truncate font-semibold">{name}</b>
        <span className="truncate text-[12.5px] text-muted">{email}</span>
      </span>
    </span>
  );
}
const ini = (s: string) => (s.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("") || "?").toUpperCase();

function Modal({ title, onClose, children, footer, width = 680 }: { title: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode; width?: number }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-[rgba(31,24,19,.42)] p-4 md:p-14" onClick={onClose}>
      <div role="dialog" aria-label={title} className="flex w-full flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(31,24,19,.35)]" style={{ maxWidth: width }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-line py-3.5 pl-[22px] pr-4">
          <b className="flex-1 font-head text-lg font-semibold">{title}</b>
          <button aria-label="Close" onClick={onClose} className="rounded-lg p-2 hover:bg-bg">
            <Close size={18} />
          </button>
        </div>
        <div className="flex flex-col gap-4 px-[22px] py-[18px]">{children}</div>
        <div className="flex justify-end gap-2 border-t border-line bg-paper px-[22px] py-3.5">{footer}</div>
      </div>
    </div>
  );
}

function useLoad<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!url) return;
    setError("");
    try {
      setData(await api<T>(url));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [url]);
  useEffect(() => {
    load();
  }, [load]);
  return { data, error, load };
}

function Problem({ text, retry }: { text: string; retry?: () => void }) {
  const notConnected = /not connected|API key/i.test(text);
  return (
    <div className="rounded-xl border border-orange-line bg-orange-soft p-3.5 text-[13.5px] text-orange-text">
      {notConnected ? (
        <>
          <b>Connect mailcow.</b> {text} Add <code>MAILCOW_API_KEY</code> to the MailTide Web app in Dokploy, then redeploy.
        </>
      ) : (
        text
      )}{" "}
      {retry && (
        <button onClick={retry} className="ml-1 font-semibold underline">
          Try again
        </button>
      )}
    </div>
  );
}

function Header({ title, sub, actions }: { title: string; sub: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-2.5">
      <div className="min-w-[260px] flex-1">
        <h1 className="m-0 font-head text-[26px] font-semibold tracking-tight">{title}</h1>
        <p className="m-0 mt-1 text-sm text-muted">{sub}</p>
      </div>
      {actions}
    </div>
  );
}

export default function AdminApp({ section, build }: { section: Section; build: string }) {
  const [toast, setToast] = useState("");
  const flash = (t: string) => {
    setToast(t);
    window.setTimeout(() => setToast(""), 4000);
  };
  const ov = useLoad<{ org: string; role: string; connected: boolean; db: boolean; domains: { name: string; ok: boolean; mailboxes: number }[]; mailboxes: number; storage: number; shared: number; activity: { at: string; actor: string; area: string; action: string }[] }>(
    "/api/admin/overview",
  );

  return (
    <div className="flex min-h-[100dvh] flex-col bg-bg">
      <TopBar product="MailTide Admin" build={build} />
      <div className="flex flex-1 flex-wrap">
        <nav aria-label="Admin sections" className="flex max-w-[260px] flex-[1_1_240px] flex-col gap-0.5 px-2.5 py-3.5">
          <label className="flex flex-col gap-1 px-1.5 pb-3 text-xs text-muted">
            Organization
            <select className="h-9 rounded-lg border border-line-strong bg-white px-2 text-sm text-ink">
              <option>{ov.data?.org || "Loading..."}</option>
            </select>
          </label>
          {NAV.map(({ key, label, href, Icon }) => (
            <Link
              key={key}
              href={href}
              className={`flex min-h-[38px] items-center gap-2.5 rounded-lg px-3 py-1 text-sm text-ink no-underline ${section === key ? "bg-[#FBF3EE] font-semibold shadow-[inset_3px_0_0_#E8693A]" : "hover:bg-white/70"}`}
            >
              <span className="text-ink-soft">
                <Icon size={17} />
              </span>
              <span className="flex-1">{label}</span>
            </Link>
          ))}
          <Link href="/mail" className="mt-3.5 flex items-center gap-2 px-3 text-[13.5px] no-underline">
            <Reply size={16} /> Back to mail
          </Link>
        </nav>
        <main className="flex min-w-0 flex-[999_1_560px] flex-col gap-[18px] px-6 pb-8 pt-[22px]">
          {section === "home" && <HomePage ov={ov} />}
          {section === "users" && <UsersPage flash={flash} />}
          {section === "mailboxes" && <MailboxesPage flash={flash} />}
          {section === "shared" && <SharedPage flash={flash} />}
          {section === "domains" && <DomainsPage flash={flash} />}
          {section === "audit" && <AuditPage />}
          {section === "billing" && <BillingPage ov={ov.data} />}
        </main>
      </div>
      {toast && (
        <div role="status" className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-ink px-4 py-2.5 text-[13.5px] font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

type Ov = ReturnType<typeof useLoad<{ org: string; role: string; connected: boolean; db: boolean; domains: { name: string; ok: boolean; mailboxes: number }[]; mailboxes: number; storage: number; shared: number; activity: { at: string; actor: string; area: string; action: string }[] }>>;

function HomePage({ ov }: { ov: Ov }) {
  const d = ov.data;
  const row = (l: string, v: React.ReactNode) => (
    <div className="flex justify-between gap-2.5 border-b border-line-faint py-2 text-[13.5px] last:border-b-0">
      <span>{l}</span>
      <span className="text-muted">{v}</span>
    </div>
  );
  return (
    <>
      <Header
        title={d?.org || "Organization"}
        sub={d ? `You are signed in as ${d.role}. You manage only this organization.` : "Loading..."}
        actions={
          <>
            <Link href="/admin/users?invite=1" className={btn}>
              Invite a member
            </Link>
            <Link href="/admin/domains?connect=1" className={btnP}>
              Connect a domain
            </Link>
          </>
        }
      />
      {ov.error && <Problem text={ov.error} retry={ov.load} />}
      {d && !d.connected && <Problem text="The admin console is not connected to mailcow yet." />}
      {d && !d.db && <Problem text="The admin database is not connected yet." />}
      {d && (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))" }}>
          <CardBox title="Domains" icon={<Globe size={18} />} action={<Link href="/admin/domains" className={btn}>View all</Link>}>
            {d.domains.length ? (
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className={th}>Domain</th>
                    <th className={th}>Status</th>
                    <th className={th}>Mailboxes</th>
                  </tr>
                </thead>
                <tbody>
                  {d.domains.map((x) => (
                    <tr key={x.name}>
                      <td className={`${td} font-semibold`}>{x.name}</td>
                      <td className={td}>{x.ok ? <Chip>Live</Chip> : <Chip tone="warn">Check DNS</Chip>}</td>
                      <td className={td}>{x.mailboxes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <span className="text-sm text-muted">No domains yet.</span>
            )}
          </CardBox>
          <CardBox title="Users and roles" icon={<People size={18} />} action={<Link href="/admin/users" className={btn}>Manage</Link>}>
            <p className="m-0 text-sm">
              <b>{d.mailboxes}</b> mailboxes in this organization.
            </p>
            <p className="m-0 text-[13px] text-muted">Roles: Org Owner, Org Admin, Billing Manager, Developer, Member.</p>
          </CardBox>
          <CardBox title="Mailboxes" icon={<Mail size={18} />} action={<Link href="/admin/mailboxes" className={btn}>Manage</Link>}>
            {row("Mailboxes", d.mailboxes)}
            {row("Shared mailboxes", d.shared)}
            {row("Storage allocated", gb(d.storage))}
          </CardBox>
          <CardBox title="Shared mailboxes" icon={<People size={18} />} action={<Link href="/admin/shared" className={btn}>Manage</Link>}>
            <p className="m-0 text-sm">{d.shared ? `${d.shared} shared ${d.shared === 1 ? "mailbox" : "mailboxes"}.` : "No shared mailboxes yet."}</p>
            <p className="m-0 text-[13px] text-muted">A shared mailbox such as support@ has its own inbox. Members use it with their own sign-in.</p>
          </CardBox>
          <CardBox title="Plan and billing" icon={<Card size={18} />} action={<Link href="/admin/billing" className={btn}>Open</Link>}>
            <div className="flex items-center gap-2.5">
              <b className="flex-1 text-[15px] font-semibold">Complimentary</b>
              <Chip>No paywall</Chip>
            </div>
            <p className="m-0 text-[13px] text-muted">Plans, payment methods and invoices will live in Sentire Cloud.</p>
          </CardBox>
          <CardBox title="Recent activity" icon={<Log size={18} />} action={<Link href="/admin/audit" className={btn}>Audit log</Link>}>
            {d.activity.length ? (
              d.activity.map((a, i) => (
                <div key={i} className="flex gap-3 border-b border-line-faint py-2 text-[13.5px] last:border-b-0">
                  <span className="w-[110px] flex-none text-muted">{when(a.at)}</span>
                  <span>{a.action}</span>
                </div>
              ))
            ) : (
              <span className="text-sm text-muted">Changes made here will be listed.</span>
            )}
          </CardBox>
        </div>
      )}
    </>
  );
}

type Member = { email: string; name: string; role: string; active: boolean; owner: boolean };
type Invite = { email: string; mailbox: string | null; role: string; invited_by: string; created_at: string; expires_at: string };

function UsersPage({ flash }: { flash: (t: string) => void }) {
  const { data, error, load } = useLoad<{ members: Member[]; invites: Invite[] }>("/api/admin/members");
  const doms = useLoad<{ domains: string[] }>("/api/admin/mailboxes");
  const [tab, setTab] = useState<"Members" | "Invitations" | "Roles">("Members");
  const [invite, setInvite] = useState(false);
  const [q, setQ] = useState("");
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("invite") === "1") setInvite(true);
  }, []);
  async function setRole(member: string, role: string) {
    try {
      await api("/api/admin/members", { method: "POST", body: JSON.stringify({ member, role }) });
      flash("Role changed");
      load();
    } catch (e) {
      flash((e as Error).message);
    }
  }
  const members = (data?.members || []).filter((m) => !q || `${m.name} ${m.email}`.toLowerCase().includes(q.toLowerCase()));
  const perm: [string, ...string[]][] = [
    ["Read and send own mail", "Yes", "Yes", "Yes", "Yes", "Yes"],
    ["Create, suspend, delete mailboxes and aliases", "Yes", "Yes", "No", "No", "No"],
    ["Connect a domain, see DNS status", "Yes", "Yes", "No", "No", "No"],
    ["Invite and remove members, change roles", "Yes", "Yes, except Owners", "No", "No", "No"],
    ["Change plan, see invoices", "Yes", "No", "Yes", "No", "No"],
    ["Postal credentials, webhooks, sending logs", "Yes", "Yes", "No", "Yes", "No"],
    ["Close organization, export data", "Yes", "No", "No", "No", "No"],
  ];
  return (
    <>
      <Header
        title="Users and roles"
        sub="Everyone in your organization and what they can do."
        actions={
          <>
            <input aria-label="Search people" placeholder="Search people" value={q} onChange={(e) => setQ(e.target.value)} className={`${inp} w-[240px]`} />
            <button onClick={() => setInvite(true)} className={btnP}>
              <AddPerson size={16} /> Invite a member
            </button>
          </>
        }
      />
      <div role="tablist" className="flex gap-1 border-b border-line">
        {(["Members", "Invitations", "Roles"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`px-3 py-2.5 text-sm ${tab === t ? "font-semibold shadow-[inset_0_-2px_0_#E8693A]" : "text-muted"}`}>
            {t}
            {t === "Members" && data ? ` (${data.members.length})` : t === "Invitations" && data ? ` (${data.invites.length})` : ""}
          </button>
        ))}
      </div>
      {error && <Problem text={error} retry={load} />}
      {tab === "Members" && data && (
        <section className="overflow-x-auto rounded-[14px] border border-line bg-white px-2 py-1.5">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>Person</th>
                <th className={th}>Role</th>
                <th className={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.email}>
                  <td className={td}>
                    <Person name={m.name || m.email.split("@")[0]} email={m.email} initials={ini(m.name || m.email)} />
                  </td>
                  <td className={td}>
                    {m.owner ? (
                      <Chip tone="warn">Org Owner</Chip>
                    ) : (
                      <select aria-label={`Role of ${m.email}`} value={m.role} onChange={(e) => setRole(m.email, e.target.value)} className="h-8 rounded-lg border border-line-strong bg-white px-2 text-[13px]">
                        {ROLES.map((r) => (
                          <option key={r}>{r}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className={td}>{m.active ? <Chip>Active</Chip> : <Chip tone="muted">Suspended</Chip>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {tab === "Invitations" && data && (
        <section className="overflow-x-auto rounded-[14px] border border-line bg-white px-2 py-1.5">
          {data.invites.length ? (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={th}>Invited</th>
                  <th className={th}>Role</th>
                  <th className={th}>Mailbox</th>
                  <th className={th}>Expires</th>
                </tr>
              </thead>
              <tbody>
                {data.invites.map((i) => (
                  <tr key={i.email + i.created_at}>
                    <td className={td}>{i.email}</td>
                    <td className={td}>
                      <Chip tone="muted">{i.role}</Chip>
                    </td>
                    <td className={td}>{i.mailbox || "None"}</td>
                    <td className={td}>{when(i.expires_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="m-3 text-sm text-muted">No open invitations.</p>
          )}
        </section>
      )}
      {tab === "Roles" && (
        <CardBox title="What each role can do" icon={<Shield size={18} />}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {["Permission", ...ROLES].map((h) => (
                    <th key={h} className={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {perm.map((r) => (
                  <tr key={r[0]}>
                    {r.map((c, i) => (
                      <td key={i} className={td}>
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="m-0 text-[13px] text-muted">An organization always keeps at least one Org Owner. Every role change is written to the audit log.</p>
        </CardBox>
      )}
      {invite && <InviteModal domains={doms.data?.domains || []} onClose={() => setInvite(false)} onDone={() => { setInvite(false); flash("Invitation sent"); load(); }} />}
    </>
  );
}

function InviteModal({ domains, onClose, onDone }: { domains: string[]; onClose: () => void; onDone: () => void }) {
  const [emails, setEmails] = useState("");
  const [role, setRole] = useState("Member");
  const [makeBox, setMakeBox] = useState(true);
  const [local, setLocal] = useState("");
  const [name, setName] = useState("");
  const [domain, setDomain] = useState(domains[0] || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!domain && domains[0]) setDomain(domains[0]);
  }, [domains, domain]);
  async function send() {
    setError("");
    setBusy(true);
    try {
      await api("/api/admin/invite", {
        method: "POST",
        body: JSON.stringify({
          emails: emails.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean),
          role,
          name: name.trim() || undefined,
          mailbox: makeBox ? { local: local.trim(), domain } : undefined,
        }),
      });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Invite a member"
      onClose={onClose}
      width={720}
      footer={
        <>
          <button onClick={onClose} className={btn}>
            Cancel
          </button>
          <button onClick={send} disabled={busy} className={btnP}>
            {busy ? "Sending..." : "Send invitation"}
          </button>
        </>
      }
    >
      {error && <div className="rounded-lg bg-orange-soft px-3 py-2 text-[13px] text-orange-text">{error}</div>}
      <label className={lab}>
        Email addresses
        <input autoFocus placeholder="name@company.com" value={emails} onChange={(e) => setEmails(e.target.value)} className={inp} />
        <span className="text-[12.5px] font-normal text-muted">They get an email with a link that works for 7 days.</span>
      </label>
      <label className={lab}>
        Their name
        <input value={name} onChange={(e) => setName(e.target.value)} className={inp} />
      </label>
      <div className="flex flex-col gap-1.5">
        <b className="text-[13.5px] font-semibold">Role</b>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ROLES.map((r) => (
            <label key={r} className={`flex items-start gap-2.5 rounded-[10px] border px-3 py-2.5 ${role === r ? "border-orange-line bg-paper" : "border-line"}`}>
              <input type="radio" name="role" checked={role === r} onChange={() => setRole(r)} className="mt-1 accent-[#E8693A]" />
              <span className="flex flex-col leading-snug">
                <b className="text-sm font-semibold">{r}</b>
                <span className="text-[12.5px] text-muted">{ROLE_HELP[r]}</span>
              </span>
            </label>
          ))}
        </div>
        <span className="text-[12.5px] text-muted">Only Org Owners can invite another Org Owner.</span>
      </div>
      <div className="flex flex-col gap-2 rounded-[10px] border border-line p-3">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={makeBox} onChange={(e) => setMakeBox(e.target.checked)} className="accent-[#E8693A]" /> Create a mailbox for them
        </label>
        {makeBox && (
          <div className="flex items-center gap-1.5">
            <input aria-label="Mailbox name" placeholder="first.last" value={local} onChange={(e) => setLocal(e.target.value)} className={`${inpBase} min-w-0 flex-1`} />
            <span className="text-muted">@</span>
            <select aria-label="Domain" value={domain} onChange={(e) => setDomain(e.target.value)} className={`${inpBase} w-[230px] max-w-[55%] shrink-0`}>
              {domains.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </div>
        )}
        <span className="text-[12.5px] text-muted">They choose their own password from the invitation link.</span>
      </div>
    </Modal>
  );
}

type Box = { email: string; name: string; active: boolean; quota: number; used: number; messages: number; shared: boolean; lastLogin: number };

function MailboxesPage({ flash }: { flash: (t: string) => void }) {
  const { data, error, load } = useLoad<{ domains: string[]; mailboxes: Box[] }>("/api/admin/mailboxes");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "suspended" | "shared">("all");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Box | null>(null);
  const list = (data?.mailboxes || []).filter(
    (b) => (!q || `${b.name} ${b.email}`.toLowerCase().includes(q.toLowerCase())) && (filter === "all" || (filter === "active" ? b.active : filter === "suspended" ? !b.active : b.shared)),
  );
  const count = (f: typeof filter) => (data?.mailboxes || []).filter((b) => (f === "all" ? true : f === "active" ? b.active : f === "suspended" ? !b.active : b.shared)).length;
  return (
    <>
      <Header
        title="Mailboxes"
        sub="Every mailbox in your organization, with storage and status."
        actions={
          <>
            <input aria-label="Search mailboxes" placeholder="Search mailboxes" value={q} onChange={(e) => setQ(e.target.value)} className={`${inp} w-[240px]`} />
            <button onClick={() => setCreating(true)} className={btnP}>
              <Plus size={16} /> New mailbox
            </button>
          </>
        }
      />
      <div className="flex flex-wrap gap-2">
        {(["all", "active", "suspended", "shared"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-md px-2.5 py-1 text-xs font-semibold ${filter === f ? "bg-ink text-white" : "bg-sand text-ink-soft"}`}>
            {f[0].toUpperCase() + f.slice(1)} ({count(f)})
          </button>
        ))}
      </div>
      {error && <Problem text={error} retry={load} />}
      {data && (
        <section className="overflow-x-auto rounded-[14px] border border-line bg-white px-2 py-1.5">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>Mailbox</th>
                <th className={th}>Type</th>
                <th className={th}>Storage</th>
                <th className={th}>Emails</th>
                <th className={th}>Status</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {list.map((b) => (
                <tr key={b.email}>
                  <td className={td}>
                    <Person name={b.name || b.email.split("@")[0]} email={b.email} initials={ini(b.name || b.email)} dark={b.shared} />
                  </td>
                  <td className={td}>{b.shared ? <Chip tone="blue">Shared mailbox</Chip> : "User mailbox"}</td>
                  <td className={td}>
                    {gb(b.used)} of {gb(b.quota)}
                  </td>
                  <td className={td}>{b.messages}</td>
                  <td className={td}>{b.active ? <Chip>Active</Chip> : <Chip tone="muted">Suspended</Chip>}</td>
                  <td className={td}>
                    {b.shared ? (
                      <Link href="/admin/shared" className={btn}>
                        Manage
                      </Link>
                    ) : (
                      <button onClick={() => setEditing(b)} className={btn}>
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {creating && data && <NewMailbox domains={data.domains} onClose={() => setCreating(false)} onDone={() => { setCreating(false); flash("Mailbox created"); load(); }} />}
      {editing && <EditMailbox box={editing} onClose={() => setEditing(null)} onDone={(t) => { setEditing(null); flash(t); load(); }} />}
    </>
  );
}

function NewMailbox({ domains, onClose, onDone }: { domains: string[]; onClose: () => void; onDone: () => void }) {
  const [local, setLocal] = useState("");
  const [domain, setDomain] = useState(domains[0] || "");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [quota, setQuota] = useState(5);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    setError("");
    try {
      await api("/api/admin/mailboxes", { method: "POST", body: JSON.stringify({ local, domain, name, password, quotaGb: quota }) });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="New mailbox" onClose={onClose} footer={<><button onClick={onClose} className={btn}>Cancel</button><button onClick={save} disabled={busy} className={btnP}>{busy ? "Creating..." : "Create mailbox"}</button></>}>
      {error && <div className="rounded-lg bg-orange-soft px-3 py-2 text-[13px] text-orange-text">{error}</div>}
      <label className={lab}>
        Name
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className={inp} />
      </label>
      <label className={lab}>
        Address
        <span className="flex items-center gap-1.5">
          <input aria-label="Mailbox name" placeholder="first.last" value={local} onChange={(e) => setLocal(e.target.value)} className={`${inpBase} min-w-0 flex-1`} />
          <span className="font-normal text-muted">@</span>
          <select aria-label="Domain" value={domain} onChange={(e) => setDomain(e.target.value)} className={`${inpBase} w-[230px] max-w-[55%] shrink-0`}>
            {domains.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </span>
      </label>
      <label className={lab}>
        Password
        <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inp} />
        <span className="text-[12.5px] font-normal text-muted">At least 10 characters. To let the person choose it, use Invite a member instead.</span>
      </label>
      <label className={lab}>
        Storage (GB)
        <input type="number" min={1} max={50} value={quota} onChange={(e) => setQuota(Number(e.target.value))} className={`${inp} w-[120px]`} />
      </label>
    </Modal>
  );
}

function EditMailbox({ box, onClose, onDone }: { box: Box; onClose: () => void; onDone: (t: string) => void }) {
  const [name, setName] = useState(box.name);
  const [quota, setQuota] = useState(Math.max(1, Math.round(box.quota / 1073741824)));
  const [error, setError] = useState("");
  const [temp, setTemp] = useState("");
  async function patch(body: Record<string, unknown>, msg: string) {
    setError("");
    try {
      const r = await api<{ tempPassword?: string }>("/api/admin/mailboxes", { method: "PATCH", body: JSON.stringify({ email: box.email, ...body }) });
      if (r.tempPassword) setTemp(r.tempPassword);
      else onDone(msg);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function remove() {
    if (!(await askConfirm({ title: `Delete ${box.email}?`, message: "The mailbox and all of its mail are deleted. This cannot be undone.", confirmLabel: "Delete mailbox", danger: true }))) return;
    try {
      await api(`/api/admin/mailboxes?email=${encodeURIComponent(box.email)}`, { method: "DELETE" });
      onDone("Mailbox deleted");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Modal title={`Edit ${box.email}`} onClose={onClose} footer={<><button onClick={onClose} className={btn}>Close</button><button onClick={() => patch({ name, quotaGb: quota }, "Mailbox saved")} className={btnP}>Save</button></>}>
      {error && <div className="rounded-lg bg-orange-soft px-3 py-2 text-[13px] text-orange-text">{error}</div>}
      {temp && (
        <div className="rounded-lg bg-[#E4F0E6] px-3 py-2.5 text-[13.5px] text-[#2C6B3A]">
          Temporary password: <code className="select-all font-bold">{temp}</code>. Give it to the person directly; they must change it when they next sign in. It is not shown again.
        </div>
      )}
      <label className={lab}>
        Display name
        <input value={name} onChange={(e) => setName(e.target.value)} className={inp} />
      </label>
      <label className={lab}>
        Storage (GB)
        <input type="number" min={1} max={50} value={quota} onChange={(e) => setQuota(Number(e.target.value))} className={`${inp} w-[120px]`} />
      </label>
      <div className="flex flex-wrap gap-2 border-t border-line pt-3.5">
        <button onClick={() => patch({ resetPassword: true }, "")} className={btn}>
          Reset password
        </button>
        <button onClick={() => patch({ active: !box.active }, box.active ? "Mailbox suspended" : "Mailbox reactivated")} className={btn}>
          {box.active ? "Suspend" : "Reactivate"}
        </button>
        <button onClick={remove} className={`${btn} text-orange-text`}>
          <Trash size={15} /> Delete
        </button>
      </div>
    </Modal>
  );
}

type Shared = { address: string; name: string; options: { saveSent?: boolean; showReplying?: boolean; sentByLine?: boolean }; members: { email: string; access: string }[] };
type Alias = { id: number; address: string; goto: string[]; active: boolean };

function SharedPage({ flash }: { flash: (t: string) => void }) {
  const sh = useLoad<{ shared: Shared[] }>("/api/admin/shared");
  const al = useLoad<{ aliases: Alias[] }>("/api/admin/aliases");
  const mb = useLoad<{ domains: string[]; mailboxes: Box[] }>("/api/admin/mailboxes");
  const [newShared, setNewShared] = useState<Shared | "new" | null>(null);
  const [newAlias, setNewAlias] = useState(false);
  const people = (mb.data?.mailboxes || []).filter((b) => !b.shared).map((b) => b.email);
  const access = (a: string) => (a === "full" ? "Full" : a === "sendas" ? "Send as" : "Read");
  async function delAlias(a: Alias) {
    if (!(await askConfirm({ title: `Delete the alias ${a.address}?`, confirmLabel: "Delete", danger: true }))) return;
    try {
      await api(`/api/admin/aliases?id=${a.id}`, { method: "DELETE" });
      flash("Alias deleted");
      al.load();
    } catch (e) {
      flash((e as Error).message);
    }
  }
  return (
    <>
      <Header
        title="Aliases and shared mailboxes"
        sub="Extra addresses that deliver to a mailbox, and mailboxes a team shares."
        actions={
          <>
            <button onClick={() => setNewAlias(true)} className={btn}>
              <At size={16} /> New alias
            </button>
            <button onClick={() => setNewShared("new")} className={btnP}>
              <People size={16} /> New shared mailbox
            </button>
          </>
        }
      />
      {(sh.error || al.error) && <Problem text={sh.error || al.error} retry={() => (sh.load(), al.load())} />}
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))" }}>
        <CardBox title="Shared mailboxes" icon={<People size={18} />} action={<button onClick={() => setNewShared("new")} className={btn}>New</button>}>
          {sh.data?.shared.length ? (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={th}>Shared mailbox</th>
                  <th className={th}>Members</th>
                  <th className={th} />
                </tr>
              </thead>
              <tbody>
                {sh.data.shared.map((s) => (
                  <tr key={s.address}>
                    <td className={td}>
                      <Person name={s.name} email={s.address} initials={ini(s.name)} dark />
                    </td>
                    <td className={td}>{s.members.map((m) => `${m.email.split("@")[0]} (${access(m.access)})`).join(", ")}</td>
                    <td className={td}>
                      <button onClick={() => setNewShared(s)} className={btn}>
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="m-0 text-sm text-muted">No shared mailboxes yet. A shared mailbox such as support@ has its own inbox; choose who can read it and who can send as it.</p>
          )}
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>Access level</th>
                <th className={th}>What it allows</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Read", "See and file mail; cannot reply as the mailbox"],
                ["Send as", "Read, and send or reply as the shared address"],
                ["Full", "Send as, plus delete mail"],
              ].map(([a, b]) => (
                <tr key={a}>
                  <td className={td}>{a}</td>
                  <td className={td}>{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="m-0 text-[12.5px] text-muted">Shared mailboxes have no password of their own and don&apos;t use a paid seat. Each person signs in with their own account.</p>
        </CardBox>
        <CardBox title="Aliases" icon={<At size={18} />} action={<button onClick={() => setNewAlias(true)} className={btn}>New</button>}>
          {al.data?.aliases.length ? (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={th}>Alias</th>
                  <th className={th}>Delivers to</th>
                  <th className={th} />
                </tr>
              </thead>
              <tbody>
                {al.data.aliases.map((a) => (
                  <tr key={a.id}>
                    <td className={`${td} font-semibold`}>{a.address}</td>
                    <td className={td}>{a.goto.join(", ")}</td>
                    <td className={td}>
                      <button aria-label={`Delete ${a.address}`} onClick={() => delAlias(a)} className="rounded-lg p-1.5 hover:bg-bg">
                        <Trash size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="m-0 text-sm text-muted">No aliases yet. An alias such as sales@ or info@ delivers to one or more mailboxes.</p>
          )}
          <p className="m-0 text-[12.5px] text-muted">Reserved names on shared domains (admin, postmaster, abuse, no-reply and others) cannot be taken.</p>
        </CardBox>
      </div>
      {newShared && (
        <SharedModal
          existing={newShared === "new" ? null : newShared}
          domains={mb.data?.domains || []}
          people={people}
          onClose={() => setNewShared(null)}
          onDone={(t) => {
            setNewShared(null);
            flash(t);
            sh.load();
            mb.load();
          }}
        />
      )}
      {newAlias && <AliasModal domains={mb.data?.domains || []} people={people} onClose={() => setNewAlias(false)} onDone={() => { setNewAlias(false); flash("Alias created"); al.load(); }} />}
    </>
  );
}

function SharedModal({ existing, domains, people, onClose, onDone }: { existing: Shared | null; domains: string[]; people: string[]; onClose: () => void; onDone: (t: string) => void }) {
  const [name, setName] = useState(existing?.name || "");
  const [local, setLocal] = useState("");
  const [domain, setDomain] = useState(domains[0] || "");
  const [members, setMembers] = useState<{ email: string; access: string }[]>(existing?.members || []);
  const [add, setAdd] = useState("");
  const [opts, setOpts] = useState({ saveSent: existing?.options.saveSent ?? true, showReplying: existing?.options.showReplying ?? true, sentByLine: existing?.options.sentByLine ?? false });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    setError("");
    try {
      if (existing) await api("/api/admin/shared", { method: "PATCH", body: JSON.stringify({ address: existing.address, name, members, options: opts }) });
      else await api("/api/admin/shared", { method: "POST", body: JSON.stringify({ local, domain, name, members, options: opts }) });
      onDone(existing ? "Shared mailbox saved" : "Shared mailbox created");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const sel = "h-8 rounded-lg border border-line-strong bg-white px-2 text-[13px]";
  return (
    <Modal
      title={existing ? `Manage ${existing.address}` : "New shared mailbox"}
      onClose={onClose}
      width={760}
      footer={
        <>
          <button onClick={onClose} className={btn}>
            Cancel
          </button>
          <button onClick={save} disabled={busy} className={btnP}>
            {busy ? "Saving..." : existing ? "Save" : "Create shared mailbox"}
          </button>
        </>
      }
    >
      {error && <div className="rounded-lg bg-orange-soft px-3 py-2 text-[13px] text-orange-text">{error}</div>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className={lab}>
          Display name
          <input autoFocus placeholder="Support" value={name} onChange={(e) => setName(e.target.value)} className={inp} />
          <span className="text-[12.5px] font-normal text-muted">Shown to people who get replies.</span>
        </label>
        {!existing && (
          <label className={lab}>
            Address
            <span className="flex items-center gap-1.5">
              <input aria-label="Address name" placeholder="support" value={local} onChange={(e) => setLocal(e.target.value)} className={`${inpBase} min-w-0 flex-1`} />
              <span className="font-normal text-muted">@</span>
              <select aria-label="Domain" value={domain} onChange={(e) => setDomain(e.target.value)} className={`${inpBase} w-[230px] max-w-[55%] shrink-0`}>
                {domains.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </span>
          </label>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <b className="text-[13.5px] font-semibold">Who can use it</b>
        <div className="flex gap-2">
          <select aria-label="Add a person" value={add} onChange={(e) => setAdd(e.target.value)} className={`${inp} flex-1`}>
            <option value="">Add a person from your organization</option>
            {people.filter((p) => !members.some((m) => m.email === p)).map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <button
            onClick={() => {
              if (add) setMembers([...members, { email: add, access: "sendas" }]);
              setAdd("");
            }}
            className={btn}
          >
            Add
          </button>
        </div>
        {members.length > 0 && (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>Person</th>
                <th className={th}>Access</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {members.map((m, i) => (
                <tr key={m.email}>
                  <td className={td}>{m.email}</td>
                  <td className={td}>
                    <select aria-label="Access level" value={m.access} onChange={(e) => setMembers(members.map((x, j) => (j === i ? { ...x, access: e.target.value } : x)))} className={sel}>
                      <option value="read">Read</option>
                      <option value="sendas">Send as</option>
                      <option value="full">Full</option>
                    </select>
                  </td>
                  <td className={td}>
                    <button aria-label={`Remove ${m.email}`} onClick={() => setMembers(members.filter((_, j) => j !== i))} className="rounded-lg p-1.5 hover:bg-bg">
                      <Close size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="flex flex-col gap-2 rounded-[10px] border border-line p-3 text-[13.5px]">
        {(
          [
            ["saveSent", "Save a copy of sent mail in the shared mailbox's Sent folder"],
            ["showReplying", "Show who replied to each email, and who is replying right now"],
            ["sentByLine", 'Add "Sent by [name]" to the bottom of replies'],
          ] as const
        ).map(([k, l]) => (
          <label key={k} className="flex items-center gap-2">
            <input type="checkbox" checked={opts[k]} onChange={(e) => setOpts({ ...opts, [k]: e.target.checked })} className="accent-[#E8693A]" /> {l}
          </label>
        ))}
      </div>
      <span className="text-[12.5px] text-muted">No password and no paid seat. Storage comes from your plan.</span>
    </Modal>
  );
}

function AliasModal({ domains, people, onClose, onDone }: { domains: string[]; people: string[]; onClose: () => void; onDone: () => void }) {
  const [local, setLocal] = useState("");
  const [domain, setDomain] = useState(domains[0] || "");
  const [goto, setGoto] = useState<string[]>([]);
  const [error, setError] = useState("");
  async function save() {
    setError("");
    try {
      await api("/api/admin/aliases", { method: "POST", body: JSON.stringify({ local, domain, goto }) });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Modal title="New alias" onClose={onClose} footer={<><button onClick={onClose} className={btn}>Cancel</button><button onClick={save} className={btnP}>Create alias</button></>}>
      {error && <div className="rounded-lg bg-orange-soft px-3 py-2 text-[13px] text-orange-text">{error}</div>}
      <label className={lab}>
        Alias address
        <span className="flex items-center gap-1.5">
          <input autoFocus placeholder="info" value={local} onChange={(e) => setLocal(e.target.value)} className={`${inp} flex-1`} />
          <span className="font-normal text-muted">@</span>
          <select aria-label="Domain" value={domain} onChange={(e) => setDomain(e.target.value)} className={`${inpBase} w-[230px] max-w-[55%] shrink-0`}>
            {domains.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </span>
      </label>
      <div className="flex flex-col gap-1.5">
        <b className="text-[13.5px] font-semibold">Delivers to</b>
        {people.map((p) => (
          <label key={p} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={goto.includes(p)} onChange={(e) => setGoto(e.target.checked ? [...goto, p] : goto.filter((x) => x !== p))} className="accent-[#E8693A]" /> {p}
          </label>
        ))}
      </div>
    </Modal>
  );
}

type Check = { type: string; name: string; value: string; status: "found" | "missing" | "wrong"; found?: string };
type Dom = { name: string; active: boolean; mailboxes: number; checks: Check[]; ok: boolean };

function DomainsPage({ flash }: { flash: (t: string) => void }) {
  const { data, error, load } = useLoad<{ domains: Dom[] }>("/api/admin/domains");
  const [open, setOpen] = useState<string | null>(null);
  const [connect, setConnect] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("connect") === "1") setConnect(true);
  }, []);
  useEffect(() => {
    if (data?.domains[0] && !open) setOpen(data.domains[0].name);
  }, [data, open]);
  const pass = (c?: Check) => (c?.status === "found" ? <Chip>Pass</Chip> : c?.status === "wrong" ? <Chip tone="warn">Wrong</Chip> : <Chip tone="warn">Missing</Chip>);
  const cur = data?.domains.find((d) => d.name === open);
  return (
    <>
      <Header
        title="Domains"
        sub="Domains your organization sends and receives mail on."
        actions={
          <>
            <button onClick={() => { load(); flash("Checking DNS records..."); }} className={btn}>
              Check all now
            </button>
            <button onClick={() => setConnect(true)} className={btnP}>
              <Globe size={16} /> Connect a domain
            </button>
          </>
        }
      />
      {error && <Problem text={error} retry={load} />}
      {!data && !error && <p className="text-sm text-muted">Checking your domains...</p>}
      {data && (
        <section className="overflow-x-auto rounded-[14px] border border-line bg-white px-2 py-1.5">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Domain", "Status", "MX", "SPF", "DKIM", "DMARC", "Mailboxes", ""].map((h) => (
                  <th key={h} className={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.domains.map((d) => (
                <tr key={d.name}>
                  <td className={`${td} font-semibold`}>{d.name}</td>
                  <td className={td}>{d.ok ? <Chip>Live</Chip> : <Chip tone="warn">Check DNS</Chip>}</td>
                  {[0, 1, 2, 3].map((i) => (
                    <td key={i} className={td}>
                      {pass(d.checks[i])}
                    </td>
                  ))}
                  <td className={td}>{d.mailboxes}</td>
                  <td className={td}>
                    <button onClick={() => setOpen(d.name)} className={btn}>
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {cur && (
        <CardBox title={`${cur.name}: DNS records`} icon={<Globe size={18} />}>
          <Records checks={cur.checks} />
        </CardBox>
      )}
      {connect && <ConnectDomain onClose={() => setConnect(false)} onDone={() => { load(); }} flash={flash} />}
    </>
  );
}

function Records({ checks }: { checks: Check[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {["Type", "Name", "Value", "Status"].map((h) => (
              <th key={h} className={th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {checks.map((c) => (
            <tr key={c.type + c.name}>
              <td className={`${td} whitespace-nowrap`}>{c.type}</td>
              <td className={td}>{c.name}</td>
              <td className={td}>
                <span className="flex items-center gap-2">
                  <code className="break-all rounded bg-bg px-1.5 py-0.5 text-[12.5px]">{c.value}</code>
                  <button aria-label="Copy value" onClick={() => navigator.clipboard?.writeText(c.value)} className="rounded p-1 text-xs text-muted hover:bg-bg">
                    Copy
                  </button>
                </span>
                {c.status === "wrong" && c.found && <span className="mt-1 block text-xs text-orange-text">Found instead: {c.found}</span>}
              </td>
              <td className={td}>{c.status === "found" ? <Chip>Found</Chip> : c.status === "wrong" ? <Chip tone="warn">Wrong</Chip> : <Chip tone="warn">Not found yet</Chip>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConnectDomain({ onClose, onDone, flash }: { onClose: () => void; onDone: () => void; flash: (t: string) => void }) {
  const [step, setStep] = useState(0);
  const [domain, setDomain] = useState("");
  const [checks, setChecks] = useState<Check[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const steps = ["Enter domain", "Check plan", "Add DNS records", "Verify", "Go live"];
  async function add() {
    setBusy(true);
    setError("");
    try {
      const r = await api<{ checks: Check[]; ready: boolean }>("/api/admin/domains", { method: "POST", body: JSON.stringify({ domain }) });
      setChecks(r.checks);
      setReady(r.ready);
      setStep(r.ready ? 4 : 2);
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function verify() {
    setBusy(true);
    try {
      const r = await api<{ checks: Check[]; ok: boolean }>(`/api/admin/domains?check=${encodeURIComponent(domain)}`);
      setChecks(r.checks);
      setReady(r.ok);
      setStep(r.ok ? 4 : 3);
      if (!r.ok) flash("Some records are not found yet. DNS changes can take up to an hour.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Connect a domain"
      onClose={onClose}
      width={920}
      footer={
        step === 0 ? (
          <>
            <button onClick={onClose} className={btn}>
              Cancel
            </button>
            <button onClick={add} disabled={busy || !domain.trim()} className={btnP}>
              {busy ? "Adding..." : "Continue"}
            </button>
          </>
        ) : step === 4 ? (
          <button onClick={onClose} className={btnP}>
            Done
          </button>
        ) : (
          <>
            <button onClick={onClose} className={btn}>
              I&apos;ll finish later
            </button>
            <button onClick={verify} disabled={busy} className={btnP}>
              {busy ? "Checking..." : "Check records now"}
            </button>
          </>
        )
      }
    >
      <ol className="m-0 flex list-none flex-wrap gap-1.5 p-0">
        {steps.map((s, i) => (
          <li key={s} className={`flex items-center gap-1.5 text-[13px] ${i === step ? "font-semibold" : "text-muted"}`}>
            <span className={`flex h-[22px] w-[22px] items-center justify-center rounded-full text-xs font-bold ${i === step ? "bg-orange text-white" : i < step ? "bg-[#E4F0E6] text-[#2C6B3A]" : "bg-sand text-muted"}`}>{i + 1}</span>
            {s}
            {i < steps.length - 1 && <span className="h-px w-[18px] bg-line-strong" />}
          </li>
        ))}
      </ol>
      {error && <div className="rounded-lg bg-orange-soft px-3 py-2 text-[13px] text-orange-text">{error}</div>}
      {step === 0 && (
        <label className={lab}>
          Your domain
          <input autoFocus placeholder="yourcompany.com" value={domain} onChange={(e) => setDomain(e.target.value)} className={inp} />
          <span className="text-[12.5px] font-normal text-muted">The domain must already be yours, at GoDaddy, Cloudflare or another DNS provider.</span>
        </label>
      )}
      {step > 0 && (
        <>
          <div className="flex items-center gap-2.5 rounded-[10px] bg-[#E4F0E6] px-3 py-2.5 text-[13.5px] text-[#2C6B3A]">
            <Shield size={16} /> Your plan includes your own domain.
          </div>
          {step < 4 ? (
            <div>
              <b className="text-[15px] font-semibold">Add these records at your DNS provider for {domain}</b>
              <p className="m-0 mt-1 text-[13px] text-muted">Copy each value into GoDaddy, Cloudflare or wherever your domain is managed, then click Check records now. Sentire finishes the sending setup once they check out.</p>
            </div>
          ) : (
            <p className="m-0 text-sm">
              <b>{domain} is ready.</b> {ready ? "Mail for this domain now arrives in MailTide. Create mailboxes for it under Mailboxes." : ""}
            </p>
          )}
          <Records checks={checks} />
        </>
      )}
    </Modal>
  );
}

function AuditPage() {
  const [days, setDays] = useState(30);
  const [area, setArea] = useState("");
  const [q, setQ] = useState("");
  const url = `/api/admin/audit?days=${days}&area=${encodeURIComponent(area)}&q=${encodeURIComponent(q)}`;
  const { data, error, load } = useLoad<{ entries: { at: string; actor: string; area: string; action: string }[] }>(url);
  const fsel = "h-9 rounded-lg border border-line-strong bg-white px-2 text-[13.5px]";
  return (
    <>
      <Header
        title="Audit log"
        sub="Who did what and when. Entries cannot be edited or deleted."
        actions={
          <a href={`${url}&format=csv`} className={btn}>
            <Download size={16} /> Export CSV
          </a>
        }
      />
      <div className="flex flex-wrap items-end gap-2.5">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Date
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className={fsel}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last year</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Area
          <select value={area} onChange={(e) => setArea(e.target.value)} className={fsel}>
            <option value="">All areas</option>
            {["Members", "Mailboxes", "Shared mailboxes", "Aliases", "Domains"].map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        <input aria-label="Search entries" placeholder="Search entries" value={q} onChange={(e) => setQ(e.target.value)} className={`${inp} w-[240px]`} />
      </div>
      {error && <Problem text={error} retry={load} />}
      <section className="overflow-x-auto rounded-[14px] border border-line bg-white px-2 py-1.5">
        {data?.entries.length ? (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["When", "Who", "Area", "What happened"].map((h) => (
                  <th key={h} className={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.entries.map((e, i) => (
                <tr key={i}>
                  <td className={`${td} whitespace-nowrap`}>{when(e.at)}</td>
                  <td className={td}>{e.actor}</td>
                  <td className={td}>
                    <Chip tone="blue">{e.area}</Chip>
                  </td>
                  <td className={td}>{e.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="m-3 text-sm text-muted">No entries for these filters yet.</p>
        )}
      </section>
      <p className="m-0 text-[13px] text-muted">Logged: role changes, invitations, mailbox, shared mailbox, alias and domain changes in this organization.</p>
    </>
  );
}

function BillingPage({ ov }: { ov: { mailboxes: number; storage: number; domains: unknown[] } | null }) {
  const row = (l: string, v: React.ReactNode) => (
    <div className="flex justify-between gap-2.5 border-b border-line-faint py-2 text-[13.5px] last:border-b-0">
      <span>{l}</span>
      <span className="text-muted">{v}</span>
    </div>
  );
  return (
    <>
      <Header title="Plan and billing" sub="A summary. Plans, payment methods and invoices will be managed in Sentire Cloud." />
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))" }}>
        <CardBox title="Current plan" icon={<Card size={18} />}>
          <div className="flex items-center gap-2.5">
            <b className="flex-1 font-head text-[22px] font-semibold">Complimentary</b>
            <Chip>No paywall</Chip>
          </div>
          <p className="m-0 text-[13.5px] text-muted">Granted by Sentire. No end date.</p>
        </CardBox>
        <CardBox title="Usage" icon={<Mail size={18} />}>
          {row("Mailboxes", ov?.mailboxes ?? "...")}
          {row("Storage allocated", ov ? gb(ov.storage) : "...")}
          {row("Domains", ov?.domains.length ?? "...")}
        </CardBox>
      </div>
      <CardBox title="Products" icon={<Mail size={18} />}>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {["Product", "Status", "Price per month"].map((h) => (
                <th key={h} className={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ["Mail on your own domain", <Chip key="a">Included</Chip>],
              ["Transactional mail (apps)", <Chip key="b">Included</Chip>],
              ["Marketing mail", <Chip key="c" tone="muted">Not started</Chip>],
            ].map(([p, s]) => (
              <tr key={String(p)}>
                <td className={td}>{p}</td>
                <td className={td}>{s}</td>
                <td className={td}>To be set</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="m-0 text-[12.5px] text-muted">Prices are still to be set (MTD-19).</p>
      </CardBox>
      <CardBox title="Invoices" icon={<Log size={18} />}>
        <p className="m-0 text-sm text-muted">No invoices. Complimentary plans are not billed. Paid organizations will see their invoices here, in BIR format.</p>
      </CardBox>
    </>
  );
}
