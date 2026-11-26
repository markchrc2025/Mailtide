"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  api,
  avatarColors,
  displayName,
  initials,
  shortDate,
  type Folder,
  type FullMessage, Thread,
  type MessageRow,
} from "@/lib/client";
import { Brand } from "./Logo";
import { Clip, Close, Logout, Menu, Plus, Refresh, RoleIcon, Search, Star } from "./Icons";
import Reader from "./Reader";
import Composer, { type Draft } from "./Composer";

type ListResp = { total: number; page: number; pageSize: number; messages: MessageRow[] };
type Toast = { text: string; tone: "ok" | "error" } | null;

export default function MailApp({ email, build }: { email: string; build: string }) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [folder, setFolder] = useState("INBOX");
  const [rows, setRows] = useState<MessageRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(40);
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [message, setMessage] = useState<FullMessage | null>(null);
  const [thread, setThread] = useState<FullMessage[]>([]);
  const [messageLoading, setMessageLoading] = useState(false);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [drawer, setDrawer] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const uidNextRef = useRef<number>(0);

  const current = folders.find((f) => f.path === folder);
  const role = current?.role ?? (folder === "INBOX" ? "inbox" : "other");

  const flash = useCallback((text: string, tone: "ok" | "error" = "ok") => {
    setToast({ text, tone });
    window.setTimeout(() => setToast(null), 3500);
  }, []);

  const loadFolders = useCallback(async () => {
    try {
      const r = await api<{ folders: Folder[] }>("/api/folders");
      setFolders(r.folders);
    } catch (e) {
      flash((e as Error).message, "error");
    }
  }, [flash]);

  const loadList = useCallback(
    async (opts?: { quiet?: boolean }) => {
      if (!opts?.quiet) setLoading(true);
      setListError("");
      try {
        const p = new URLSearchParams({ folder, page: String(page) });
        if (activeQuery) p.set("q", activeQuery);
        if (unreadOnly) p.set("unread", "1");
        if (role === "drafts") p.set("group", "0");
        const r = await api<ListResp>(`/api/messages?${p}`);
        setRows(r.messages);
        setTotal(r.total);
        setPageSize(r.pageSize);
      } catch (e) {
        setListError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [folder, page, activeQuery, unreadOnly, role],
  );

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  // Check for new mail every 30 seconds while the tab is open.
  useEffect(() => {
    uidNextRef.current = 0;
    const tick = async () => {
      if (document.hidden) return;
      try {
        const s = await api<{ uidNext: number; unseen: number }>(`/api/poll?folder=${encodeURIComponent(folder)}`);
        if (uidNextRef.current && s.uidNext !== uidNextRef.current) {
          loadList({ quiet: true });
          loadFolders();
        }
        uidNextRef.current = s.uidNext;
      } catch {
        /* the next tick will try again */
      }
    };
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [folder, loadList, loadFolders]);

  const open = useCallback(
    async (uid: number) => {
      setSelected(uid);
      setMessageLoading(true);
      try {
        const row = rows.find((r) => r.uid === uid);
        const also = (row?.uids || []).filter((u) => u !== uid);
        const t = await api<Thread>(
          `/api/thread/${uid}?folder=${encodeURIComponent(folder)}${also.length ? `&also=${also.join(",")}` : ""}`,
        );
        const m = t.messages.find((x) => x.uid === t.opened.uid && x.folder === t.opened.folder) || t.messages[0];
        setThread(t.messages);
        setMessage(m);
        setRows((rs) => rs.map((r) => (r.uid === uid ? { ...r, seen: true } : r)));
        // Opening a conversation reads all of it, like Outlook.
        const unreadOthers = t.messages.filter((x) => x.folder === folder && x.unread && x.uid !== uid).map((x) => x.uid);
        if (unreadOthers.length)
          api("/api/actions", { method: "POST", body: JSON.stringify({ folder, uids: unreadOthers, action: "read" }) })
            .then(() => loadFolders())
            .catch(() => null);
        setFolders((fs) =>
          fs.map((f) => (f.path === folder && rows.find((r) => r.uid === uid && !r.seen) ? { ...f, unseen: Math.max(0, f.unseen - 1) } : f)),
        );
      } catch (e) {
        flash((e as Error).message, "error");
        setSelected(null);
      } finally {
        setMessageLoading(false);
      }
    },
    [folder, rows, flash, loadFolders],
  );

  const act = useCallback(
    async (action: string, picked: number[], target?: string) => {
      // A list row stands for its whole conversation.
      const uids = [...new Set(picked.flatMap((u) => rows.find((r) => r.uid === u)?.uids ?? [u]))];
      if (!uids.length) return;
      const hit = (r: MessageRow) => (r.uids ?? [r.uid]).some((u) => uids.includes(u));
      try {
        const r = await api<{ moved: string | null; deleted: boolean }>("/api/actions", {
          method: "POST",
          body: JSON.stringify({ folder, uids, action, target }),
        });
        if (r.moved || r.deleted) {
          setRows((rs) => rs.filter((x) => !hit(x)));
          setTotal((t) => Math.max(0, t - uids.length));
          if (selected && uids.includes(selected)) {
            setSelected(null);
            setMessage(null);
          }
          const label: Record<string, string> = { archive: "Archived", trash: r.deleted ? "Deleted for good" : "Moved to Trash", spam: "Marked as spam", notspam: "Moved to Inbox", move: "Moved" };
          flash(`${label[action] ?? "Done"}${picked.length > 1 ? ` (${picked.length})` : ""}`);
        } else {
          setRows((rs) =>
            rs.map((x) =>
              hit(x)
                ? { ...x, seen: action === "read" ? true : action === "unread" ? false : x.seen, flagged: action === "flag" ? true : action === "unflag" ? false : x.flagged }
                : x,
            ),
          );
          if (message && uids.includes(message.uid) && (action === "flag" || action === "unflag")) setMessage({ ...message, flagged: action === "flag" });
        }
        setChecked(new Set());
        loadFolders();
      } catch (e) {
        flash((e as Error).message, "error");
      }
    },
    [folder, selected, message, flash, loadFolders, rows],
  );

  function switchFolder(path: string) {
    setFolder(path);
    setPage(1);
    setSelected(null);
    setMessage(null);
    setChecked(new Set());
    setQuery("");
    setActiveQuery("");
    setDrawer(false);
  }

  function runSearch(e?: React.FormEvent) {
    e?.preventDefault();
    setPage(1);
    setActiveQuery(query.trim());
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => null);
    window.location.href = "/login";
  }

  // Keyboard shortcuts: c compose, / or Ctrl/Cmd+K search, e archive, # delete, j/k move.
  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      const t = ev.target as HTMLElement;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "k") {
        ev.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (typing || draft) return;
      if (ev.key === "/") {
        ev.preventDefault();
        searchRef.current?.focus();
      } else if (ev.key === "c" && !ev.metaKey && !ev.ctrlKey && !ev.altKey) {
        // Stop the "c" from landing in the To field that opens with focus.
        ev.preventDefault();
        setDraft({});
      } else if (ev.key === "e" && selected) {
        act("archive", [selected]);
      } else if (ev.key === "#" && selected) {
        act("trash", [selected]);
      } else if (ev.key === "j" || ev.key === "k") {
        const i = rows.findIndex((r) => r.uid === selected);
        const next = rows[ev.key === "j" ? i + 1 : Math.max(0, i - 1)];
        if (next) open(next.uid);
      } else if (ev.key === "Escape" && selected) {
        setSelected(null);
        setMessage(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rows, selected, draft, act, open]);

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const inboxUnseen = folders.find((f) => f.role === "inbox")?.unseen ?? 0;
  const allChecked = rows.length > 0 && rows.every((r) => checked.has(r.uid));
  const title = activeQuery ? `Results for "${activeQuery}"` : current?.name ?? "Inbox";
  const me = useMemo(() => ({ name: "", address: email }), [email]);

  useEffect(() => {
    document.title = inboxUnseen ? `(${inboxUnseen}) MailTide` : "MailTide";
  }, [inboxUnseen]);

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      {/* Sidebar */}
      {drawer && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setDrawer(false)} />}
      <nav
        aria-label="Mailboxes"
        className={`espresso fixed inset-y-0 left-0 z-40 flex w-[256px] flex-col gap-3.5 px-3.5 pb-3.5 pt-[18px] text-espresso-text transition-transform lg:static lg:translate-x-0 ${
          drawer ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Brand />
        <button
          onClick={() => {
            setDraft({});
            setDrawer(false);
          }}
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-orange text-sm font-semibold text-white shadow-[0_6px_16px_-6px_rgba(232,105,58,.7)] hover:bg-orange-press"
        >
          <Plus size={17} /> New email
        </button>
        <div className="scroll-thin flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
          {folders.length === 0 && <span className="px-3 py-2 text-[13px] text-espresso-dim">Loading folders...</span>}
          {folders.map((f) => {
            const on = f.path === folder && !activeQuery;
            return (
              <button
                key={f.path}
                onClick={() => switchFolder(f.path)}
                className={`flex items-center gap-2.5 rounded-[9px] px-3 py-[9px] text-left text-[13.5px] ${
                  on ? "bg-[rgba(232,105,58,.18)] font-semibold text-white shadow-[inset_3px_0_0_#E8693A]" : "text-espresso-text hover:bg-white/5"
                }`}
                style={{ fontFamily: "inherit" }}
              >
                <span className={on ? "text-orange" : "text-espresso-label"}>
                  <RoleIcon role={f.role} />
                </span>
                <span className="flex-1 truncate">{f.name}</span>
                {f.unseen > 0 && f.role !== "sent" && f.role !== "trash" && (
                  <span className={`text-xs font-semibold ${on ? "text-white" : "text-espresso-label"}`}>{f.unseen}</span>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[.06] px-[11px] py-[9px]">
          <div className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px] bg-orange font-head text-[13px] font-bold text-white">
            {initials(me)}
          </div>
          <div className="flex min-w-0 flex-1 flex-col leading-tight">
            <b className="truncate text-[13px] font-semibold text-white">{displayName(me)}</b>
            <span className="truncate text-[11px] text-espresso-dim">{email}</span>
          </div>
          <button onClick={logout} title="Sign out" aria-label="Sign out" className="rounded-md p-1.5 text-espresso-dim hover:bg-white/10 hover:text-white">
            <Logout size={16} />
          </button>
        </div>
        <span className="px-1 text-[10.5px] text-espresso-label">MailTide {build}</span>
      </nav>

      {/* Message list */}
      <section
        aria-label="Message list"
        className={`flex min-w-0 flex-1 flex-col border-r border-line bg-white md:max-w-[440px] md:flex-none md:basis-[400px] lg:basis-[420px] ${
          selected ? "hidden md:flex" : "flex"
        }`}
      >
        <div className="flex flex-col gap-3 px-4 pb-2.5 pt-4">
          <div className="flex items-center gap-2">
            <button onClick={() => setDrawer(true)} aria-label="Open folders" className="rounded-lg p-2 text-ink hover:bg-bg lg:hidden">
              <Menu />
            </button>
            <form onSubmit={runSearch} className="flex h-[42px] flex-1 items-center gap-2.5 rounded-[11px] border border-line bg-bg px-3 text-[13.5px] text-muted focus-within:border-orange">
              <Search size={16} />
              <label htmlFor="mt-search" className="sr-only">Search mail</label>
              <input
                id="mt-search"
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setQuery("");
                    setActiveQuery("");
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                placeholder="Search mail"
                className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-muted"
              />
              {query ? (
                <button type="button" aria-label="Clear search" onClick={() => { setQuery(""); setActiveQuery(""); }} className="text-muted hover:text-ink">
                  <Close size={15} />
                </button>
              ) : (
                <span className="hidden rounded-md border border-line-strong bg-white px-1.5 py-0.5 font-head text-[11px] font-semibold sm:inline">⌘K</span>
              )}
            </form>
          </div>
          <div className="flex items-center gap-1.5">
            {[
              ["All", false],
              ["Unread", true],
            ].map(([label, val]) => (
              <button
                key={String(label)}
                onClick={() => { setUnreadOnly(val as boolean); setPage(1); }}
                className={`h-8 rounded-full px-3 text-[12.5px] font-medium ${
                  unreadOnly === val ? "border border-ink bg-ink text-white" : "border border-line-strong bg-white text-ink-soft hover:bg-bg"
                }`}
              >
                {label as string}
              </button>
            ))}
            <div className="flex-1" />
            <button onClick={() => { loadList(); loadFolders(); }} aria-label="Refresh" title="Refresh" className="rounded-lg p-2 text-muted hover:bg-bg hover:text-ink">
              <Refresh size={16} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 border-y border-line-faint bg-paper px-4 py-2 text-[12.5px] text-muted">
          <input
            type="checkbox"
            aria-label="Select all"
            checked={allChecked}
            onChange={() => setChecked(allChecked ? new Set() : new Set(rows.map((r) => r.uid)))}
            className="h-4 w-4 accent-[#E8693A]"
          />
          {checked.size > 0 ? (
            <div className="flex flex-1 flex-wrap items-center gap-1.5">
              <span className="mr-1 font-semibold text-ink">{checked.size} selected</span>
              {role !== "archive" && <BulkBtn onClick={() => act("archive", [...checked])}>Archive</BulkBtn>}
              <BulkBtn onClick={() => act("trash", [...checked])}>{role === "trash" ? "Delete for good" : "Delete"}</BulkBtn>
              <BulkBtn onClick={() => act("read", [...checked])}>Mark read</BulkBtn>
              <BulkBtn onClick={() => act("unread", [...checked])}>Mark unread</BulkBtn>
            </div>
          ) : (
            <span className="flex-1 truncate font-head font-semibold text-ink">
              {title} <span className="font-normal text-muted">· {total}</span>
            </span>
          )}
        </div>

        <div className="scroll-thin flex-1 overflow-y-auto">
          {loading && rows.length === 0 && <ListSkeleton />}
          {listError && (
            <div className="m-4 rounded-xl border border-orange-line bg-orange-soft p-3 text-[13px] text-orange-text">
              {listError} <button className="ml-1 font-semibold underline" onClick={() => loadList()}>Try again</button>
            </div>
          )}
          {!loading && !listError && rows.length === 0 && (
            <div className="flex flex-col items-center gap-1 px-6 py-16 text-center">
              <b className="font-head text-[15px]">{activeQuery ? "No emails match your search" : unreadOnly ? "You're all caught up" : "Nothing here yet"}</b>
              <span className="text-[13px] text-muted">{activeQuery ? "Try other words, a name or an email address." : "New emails will show up here."}</span>
            </div>
          )}
          {rows.map((m) => {
            const who = role === "sent" || role === "drafts" ? m.to[0] : m.from[0];
            const [bg, fg] = avatarColors(who?.address || "?");
            const isSel = m.uid === selected;
            return (
              <div
                key={m.uid}
                className={`group flex cursor-pointer gap-3 border-t border-line-faint px-4 py-[13px] ${
                  isSel ? "bg-[#FBF3EE] shadow-[inset_3px_0_0_#E8693A]" : "bg-white hover:bg-paper"
                }`}
                onClick={() => (role === "drafts" ? openDraft(m.uid) : open(m.uid))}
              >
                <div className="relative flex-none">
                  <div
                    className="flex h-[38px] w-[38px] items-center justify-center rounded-full font-head text-[13px] font-semibold group-hover:hidden"
                    style={{ background: bg, color: fg, display: checked.has(m.uid) ? "none" : undefined }}
                  >
                    {initials(who)}
                  </div>
                  <label className={`h-[38px] w-[38px] items-center justify-center ${checked.has(m.uid) ? "flex" : "hidden group-hover:flex"}`} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label="Select"
                      checked={checked.has(m.uid)}
                      onChange={() => {
                        const n = new Set(checked);
                        if (n.has(m.uid)) n.delete(m.uid);
                        else n.add(m.uid);
                        setChecked(n);
                      }}
                      className="h-4 w-4 accent-[#E8693A]"
                    />
                  </label>
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  <div className="flex items-baseline gap-2">
                    {!m.seen && <span className="h-2 w-2 flex-none self-center rounded-full bg-orange" aria-label="Unread" />}
                    <b className={`flex-1 truncate text-[13.5px] text-ink ${m.seen ? "font-normal" : "font-semibold"}`}>
                      {role === "sent" || role === "drafts" ? `To: ${displayName(who)}` : displayName(who)}
                    </b>
                    {(m.count ?? 1) > 1 && (
                      <span className="flex-none rounded-md bg-sand px-1.5 text-[11px] font-semibold text-muted" aria-label={`${m.count} emails in this conversation`}>
                        {m.count}
                      </span>
                    )}
                    {m.attachments && <Clip size={13} className="flex-none text-muted" />}
                    <span className="flex-none text-xs text-muted">{shortDate(m.date)}</span>
                  </div>
                  <span className={`truncate text-[13px] text-ink ${m.seen ? "font-normal" : "font-semibold"}`}>{m.subject}</span>
                  <div className="flex items-center gap-2">
                    <span className="flex-1 truncate text-[12.5px] text-muted">{m.snippet}</span>
                    <button
                      aria-label={m.flagged ? "Unstar" : "Star"}
                      onClick={(e) => {
                        e.stopPropagation();
                        act(m.flagged ? "unflag" : "flag", [m.uid]);
                      }}
                      className={`flex-none ${m.flagged ? "text-[#C7913D]" : "text-line-strong opacity-0 group-hover:opacity-100"}`}
                    >
                      <Star size={15} filled={m.flagged} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {pages > 1 && (
            <div className="flex items-center justify-between border-t border-line-faint px-4 py-3 text-[12.5px] text-muted">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-line-strong px-3 py-1.5 font-medium text-ink disabled:opacity-40">
                Newer
              </button>
              <span>
                Page {page} of {pages}
              </span>
              <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="rounded-lg border border-line-strong px-3 py-1.5 font-medium text-ink disabled:opacity-40">
                Older
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Reader */}
      <main className={`min-w-0 flex-1 flex-col bg-bg ${selected ? "flex" : "hidden md:flex"}`}>
        <Reader
          message={message}
          thread={thread}
          loading={messageLoading}
          role={role}
          folders={folders}
          onBack={() => {
            setSelected(null);
            setMessage(null);
          }}
          onAction={(a, target) => message && act(a, [message.uid], target)}
          onCompose={(d) => setDraft(d)}
          onSent={() => {
            flash("Sent");
            loadFolders();
          }}
          onError={(t) => flash(t, "error")}
        />
      </main>

      {draft && (
        <Composer
          initial={draft}
          onClose={() => setDraft(null)}
          onDone={(mode) => {
            setDraft(null);
            flash(mode === "send" ? "Sent" : "Draft saved");
            loadFolders();
            if (role === "sent" || role === "drafts") loadList({ quiet: true });
          }}
        />
      )}

      {toast && (
        <div
          role="status"
          className={`fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl px-4 py-2.5 text-[13.5px] font-medium shadow-lg ${
            toast.tone === "ok" ? "bg-ink text-white" : "bg-orange-text text-white"
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );

  async function openDraft(uid: number) {
    try {
      const m = await api<FullMessage>(`/api/messages/${uid}?folder=${encodeURIComponent(folder)}`);
      setDraft({
        to: m.to.map((a) => a.address).join(", "),
        cc: m.cc.map((a) => a.address).join(", "),
        subject: m.subject === "(no subject)" ? "" : m.subject,
        text: m.text,
        draftUid: uid,
        inReplyTo: undefined,
      });
    } catch (e) {
      flash((e as Error).message, "error");
    }
  }
}

function BulkBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="h-7 rounded-lg border border-line-strong bg-white px-2.5 text-xs font-medium text-ink hover:bg-bg">
      {children}
    </button>
  );
}

function ListSkeleton() {
  return (
    <div aria-hidden="true">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex gap-3 border-t border-line-faint px-4 py-[13px]">
          <div className="h-[38px] w-[38px] flex-none animate-pulse rounded-full bg-sand" />
          <div className="flex flex-1 flex-col gap-2 pt-1">
            <div className="h-3 w-2/5 animate-pulse rounded bg-sand" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-sand" />
            <div className="h-3 w-3/5 animate-pulse rounded bg-line-faint" />
          </div>
        </div>
      ))}
    </div>
  );
}
