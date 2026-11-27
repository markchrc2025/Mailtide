"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  api,
  avatarColors,
  dateGroup,
  displayName,
  initials,
  shortDate,
  type Folder,
  type FullMessage,
  type Thread,
  type MessageRow,
} from "@/lib/client";
import {
  Archive,
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronRight,
  Clip,
  EnvelopeOpen,
  Folder as FolderIcon,
  Forward,
  Mail,
  Menu,
  Pen,
  Refresh,
  Reply,
  ReplyAll,
  RoleIcon,
  Spam,
  Star,
  Trash,
} from "./Icons";
import { Shell } from "./Shell";
import Reader, { forwardDraft, replyDraft } from "./Reader";
import Composer, { type Draft, type FromOption } from "./Composer";

type SharedBox = { address: string; name: string; access: "read" | "sendas" | "full"; options: { showReplying?: boolean } };
type TeamRow = { thread: string; member: string; name: string; started_at?: string; at?: string };
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
  const [shared, setShared] = useState<SharedBox[]>([]);
  const [mbox, setMbox] = useState<string | null>(null);
  const [team, setTeam] = useState<{ replying: TeamRow[]; replied: TeamRow[] }>({ replying: [], replied: [] });
  const [selectedKey, setSelectedKey] = useState<string | undefined>(undefined);
  const [notReplied, setNotReplied] = useState(false);
  const box = useCallback((u: string) => (mbox ? `${u}${u.includes("?") ? "&" : "?"}mbox=${encodeURIComponent(mbox)}` : u), [mbox]);
  const sharedBox = shared.find((x) => x.address === mbox) || null;
  const [tab, setTab] = useState<"Home" | "View" | "Help">("Home");
  const [newMenu, setNewMenu] = useState(false);
  const [paneOpen, setPaneOpen] = useState(true);
  const [favOpen, setFavOpen] = useState(true);
  const [acctOpen, setAcctOpen] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [closedGroups, setClosedGroups] = useState<Set<string>>(new Set());
  const [grouping, setGroupingState] = useState(true);
  useEffect(() => {
    try {
      setGroupingState(localStorage.getItem("mt.grouping") !== "0");
    } catch {
      /* storage can be blocked; keep the default */
    }
  }, []);
  const setGrouping = (v: boolean) => {
    setGroupingState(v);
    try {
      localStorage.setItem("mt.grouping", v ? "1" : "0");
    } catch {
      /* ignore */
    }
  };
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
      const r = await api<{ folders: Folder[] }>(box("/api/folders"));
      setFolders(r.folders);
    } catch (e) {
      flash((e as Error).message, "error");
    }
  }, [flash, box]);

  const listSeq = useRef(0);
  const loadList = useCallback(
    async (opts?: { quiet?: boolean }) => {
      if (!opts?.quiet) setLoading(true);
      setListError("");
      try {
        const p = new URLSearchParams({ folder, page: String(page) });
        if (activeQuery) p.set("q", activeQuery);
        if (unreadOnly) p.set("unread", "1");
        if (role === "drafts" || !grouping) p.set("group", "0");
        const seq = ++listSeq.current;
        const r = await api<ListResp>(box(`/api/messages?${p}`));
        // A slower, older answer (another folder, or the list before a setting loaded) must not replace a newer one.
        if (seq !== listSeq.current) return;
        setRows(r.messages);
        setTotal(r.total);
        setPageSize(r.pageSize);
      } catch (e) {
        setListError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [folder, page, activeQuery, unreadOnly, role, grouping, box],
  );

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  useEffect(() => {
    api<{ shared: SharedBox[] }>("/api/shared").then((r) => setShared(r.shared)).catch(() => null);
  }, []);

  // Live team status for the open shared mailbox: who is replying, who replied.
  useEffect(() => {
    setTeam({ replying: [], replied: [] });
    if (!mbox) return;
    const es = new EventSource(`/api/presence/stream?mbox=${encodeURIComponent(mbox)}`);
    es.onmessage = (e) => {
      try {
        setTeam(JSON.parse(e.data));
      } catch {
        /* ignore a bad frame */
      }
    };
    return () => es.close();
  }, [mbox]);

  // While a reply from a shared mailbox is open, tell teammates (kept alive every 20 s).
  const presenceKey = draft?.from && draft.threadKey ? `${draft.from}|${draft.threadKey}` : "";
  useEffect(() => {
    if (!presenceKey) return;
    const [from, thread] = presenceKey.split("|");
    const send = (state: string) =>
      api(`/api/presence?mbox=${encodeURIComponent(from)}`, { method: "POST", body: JSON.stringify({ thread, state }) }).catch(() => null);
    send("start");
    const id = window.setInterval(() => send("beat"), 20_000);
    return () => {
      window.clearInterval(id);
      send("stop");
    };
  }, [presenceKey]);

  function switchMailbox(addr: string | null) {
    setMbox(addr);
    setFolder("INBOX");
    setFolders([]);
    setPage(1);
    setSelected(null);
    setMessage(null);
    setChecked(new Set());
    setNotReplied(false);
    setDrawer(false);
  }

  const canSend = !sharedBox || sharedBox.access !== "read";
  const fromOptions: FromOption[] = [
    { address: email, label: email },
    ...shared.filter((x) => x.access !== "read").map((x) => ({ address: x.address, label: `${x.name} <${x.address}>` })),
  ];
  function compose(d: Draft) {
    setDraft(sharedBox && canSend ? { ...d, from: sharedBox.address, threadKey: d.replyToUid ? selectedKey : undefined } : d);
  }

  // /mail?compose=address opens a new email to that address (from Contacts).
  useEffect(() => {
    const to = new URLSearchParams(window.location.search).get("compose");
    if (to) {
      setDraft({ to });
      window.history.replaceState(null, "", "/mail");
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  // Check for new mail every 30 seconds while the tab is open.
  useEffect(() => {
    uidNextRef.current = 0;
    const tick = async () => {
      if (document.hidden) return;
      try {
        const s = await api<{ uidNext: number; unseen: number }>(box(`/api/poll?folder=${encodeURIComponent(folder)}`));
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

  const open_ = useCallback(
    async (uid: number) => {
      setSelected(uid);
      setMessageLoading(true);
      try {
        const row = rows.find((r) => r.uid === uid);
        const also = (row?.uids || []).filter((u) => u !== uid);
        const t = await api<Thread>(box(`/api/thread/${uid}?folder=${encodeURIComponent(folder)}${also.length ? `&also=${also.join(",")}` : ""}`));
        if (mbox) t.messages = t.messages.map((x) => ({ ...x, attachments: x.attachments.map((a) => ({ ...a, url: `${a.url}&mbox=${encodeURIComponent(mbox)}` })) }));
        setSelectedKey(row?.key);
        const m = t.messages.find((x) => x.uid === t.opened.uid && x.folder === t.opened.folder) || t.messages[0];
        setThread(t.messages);
        setMessage(m);
        setRows((rs) => rs.map((r) => (r.uid === uid ? { ...r, seen: true } : r)));
        // Opening a conversation reads all of it, like Outlook.
        const unreadOthers = t.messages.filter((x) => x.folder === folder && x.unread && x.uid !== uid).map((x) => x.uid);
        if (unreadOthers.length)
          api(box("/api/actions"), { method: "POST", body: JSON.stringify({ folder, uids: unreadOthers, action: "read" }) })
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
    [folder, rows, flash, loadFolders, box, mbox],
  );

  const act = useCallback(
    async (action: string, picked: number[], target?: string) => {
      // A list row stands for its whole conversation.
      const uids = [...new Set(picked.flatMap((u) => rows.find((r) => r.uid === u)?.uids ?? [u]))];
      if (!uids.length) return;
      const hit = (r: MessageRow) => (r.uids ?? [r.uid]).some((u) => uids.includes(u));
      try {
        const r = await api<{ moved: string | null; deleted: boolean }>(box("/api/actions"), {
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
          setChecked(new Set());
        } else {
          // Read, unread and star keep the ticks, so a second action (Archive, Move) can follow as in Outlook.
          setRows((rs) =>
            rs.map((x) =>
              hit(x)
                ? { ...x, seen: action === "read" ? true : action === "unread" ? false : x.seen, flagged: action === "flag" ? true : action === "unflag" ? false : x.flagged }
                : x,
            ),
          );
          if (message && uids.includes(message.uid) && (action === "flag" || action === "unflag")) setMessage({ ...message, flagged: action === "flag" });
        }
        loadFolders();
      } catch (e) {
        flash((e as Error).message, "error");
      }
    },
    [folder, selected, message, flash, loadFolders, rows, box],
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
        if (next) open_(next.uid);
      } else if (ev.key === "Escape" && selected) {
        setSelected(null);
        setMessage(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rows, selected, draft, act, open_]);

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const inboxUnseen = folders.find((f) => f.role === "inbox")?.unseen ?? 0;
  const allChecked = rows.length > 0 && rows.every((r) => checked.has(r.uid));
  const title = activeQuery ? `Results for "${activeQuery}"` : current?.name ?? "Inbox";

  useEffect(() => {
    document.title = inboxUnseen ? `(${inboxUnseen}) MailTide` : "MailTide";
  }, [inboxUnseen]);

  const nowMs = Date.now();
  const teamStatus = (key?: string, answered?: boolean): { text: string; tone: "open" | "done" | "busy" } | null => {
    if (!sharedBox || !key) return null;
    const busy = team.replying.filter((r) => r.thread === key);
    if (busy.length) return { text: `${busy.map((b) => (b.member === email ? "You" : b.name)).join(", ")} ${busy.length === 1 && busy[0].member !== email ? "is" : "are"} replying now`, tone: "busy" };
    const done = team.replied.find((r) => r.thread === key);
    if (done) {
      const mins = Math.round((nowMs - new Date(done.at || "").getTime()) / 60000);
      return { text: `Replied by ${done.member === email ? "you" : done.name}${mins < 1 ? ", just now" : `, ${shortDate(done.at || "")}`}`, tone: "done" };
    }
    if (answered) return { text: "Replied", tone: "done" };
    return { text: "Not replied yet", tone: "open" };
  };
  const visibleRows = notReplied ? rows.filter((r) => teamStatus(r.key, r.answered)?.tone === "open") : rows;
  const othersReplying = sharedBox && selectedKey ? team.replying.filter((r) => r.thread === selectedKey && r.member !== email) : [];

  const targets = checked.size ? [...checked] : selected ? [selected] : [];
  const targetRows = rows.filter((r) => targets.includes(r.uid));
  const allTargetsRead = targetRows.length > 0 && targetRows.every((r) => r.seen);
  const allTargetsStarred = targetRows.length > 0 && targetRows.every((r) => r.flagged);
  const moveTargets = folders.filter((f) => f.path !== folder);
  const favorites = (["inbox", "sent", "drafts"] as const).map((r) => folders.find((f) => f.role === r)).filter(Boolean) as Folder[];

  // Rows grouped by day, like Outlook (Today, Yesterday, This week...).
  const groups: { label: string; rows: MessageRow[] }[] = [];
  for (const r of visibleRows) {
    const label = dateGroup(r.date);
    const g = groups[groups.length - 1];
    if (g && g.label === label) g.rows.push(r);
    else groups.push({ label, rows: [r] });
  }

  const folderButton = (f: Folder, key: string) => {
    const on = f.path === folder && !activeQuery;
    const showCount = f.unseen > 0 && f.role !== "sent" && f.role !== "trash" && f.role !== "drafts";
    return (
      <button
        key={key}
        onClick={() => switchFolder(f.path)}
        className={`flex h-9 w-full items-center gap-2.5 rounded-lg pl-3.5 pr-3 text-left text-sm ${on ? "bg-[#FBF3EE] font-semibold shadow-[inset_3px_0_0_#E8693A]" : "hover:bg-white/70"}`}
      >
        <span className="text-ink-soft">
          <RoleIcon role={f.role} />
        </span>
        <span className="flex-1 truncate">{f.name}</span>
        {showCount && <span className="text-[12.5px] font-bold text-orange-text">{f.unseen}</span>}
      </button>
    );
  };

  const section = (label: string, open: boolean, toggle: () => void) => (
    <button onClick={toggle} aria-expanded={open} className="flex w-full items-center gap-1.5 px-2 pb-1.5 pt-3 text-left text-[13px] font-semibold text-ink-soft">
      {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      <span className="truncate">{label}</span>
    </button>
  );

  const settingsPanel = (
    <label className="flex items-center justify-between gap-3">
      <span>
        <b className="block font-semibold">Group into conversations</b>
        <span className="text-[12.5px] text-muted">Replies show as one row in the list</span>
      </span>
      <input type="checkbox" checked={grouping} onChange={(e) => setGrouping(e.target.checked)} className="h-4 w-4 accent-[#E8693A]" />
    </label>
  );

  return (
    <Shell
      active="mail"
      unread={inboxUnseen}
      build={build}
      settings={settingsPanel}
      search={{
        value: query,
        onChange: setQuery,
        onSubmit: () => runSearch(),
        onClear: () => {
          setQuery("");
          setActiveQuery("");
        },
        inputRef: searchRef,
        placeholder: "Search mail",
      }}
    >
      {/* Ribbon */}
      <div className="mx-2.5 mt-2 flex flex-none flex-col gap-0.5 rounded-xl border border-line bg-white px-2 pb-1.5 pt-1">
        <div role="tablist" aria-label="Ribbon" className="flex gap-1 text-[13.5px]">
          {(["Home", "View", "Help"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`px-2.5 py-1.5 ${tab === t ? "font-semibold shadow-[inset_0_-2px_0_#E8693A]" : "text-muted hover:text-ink"}`}
            >
              {t}
            </button>
          ))}
          <button onClick={() => setDrawer(true)} aria-label="Open folders" className="ml-auto rounded-lg px-2 text-ink lg:hidden">
            <Menu size={18} />
          </button>
        </div>
        <div className="scroll-thin flex items-center gap-0.5 overflow-x-auto whitespace-nowrap">
          {tab === "Home" && (
            <>
              <div className="relative flex flex-none">
                <button onClick={() => compose({})} className="flex h-[34px] items-center gap-1.5 rounded-l-lg bg-orange pl-3 pr-2.5 text-[13.5px] font-semibold text-white hover:bg-orange-press">
                  <Pen size={16} /> New email
                </button>
                <button
                  aria-label="More new items"
                  aria-expanded={newMenu}
                  onClick={() => setNewMenu((v) => !v)}
                  className="flex h-[34px] items-center rounded-r-lg border-l border-white/40 bg-orange px-2 text-white hover:bg-orange-press"
                >
                  <ChevronDown size={14} />
                </button>
              </div>
              <Sep />
              <RibbonBtn disabled={!targets.length} onClick={() => act("trash", targets)} icon={<Trash size={17} />}>
                {role === "trash" ? "Delete for good" : "Delete"}
              </RibbonBtn>
              {role !== "archive" && (
                <RibbonBtn disabled={!targets.length} onClick={() => act("archive", targets)} icon={<Archive size={17} />}>
                  Archive
                </RibbonBtn>
              )}
              <RibbonBtn disabled={!targets.length} onClick={() => act(role === "junk" ? "notspam" : "spam", targets)} icon={<Spam size={17} />}>
                {role === "junk" ? "Not spam" : "Spam"}
              </RibbonBtn>
              <label className="sr-only" htmlFor="mt-move">
                Move to folder
              </label>
              <span className="flex h-[34px] flex-none items-center gap-1.5 rounded-lg px-2 text-[13.5px] text-ink">
                <FolderIcon size={17} />
                <select
                  id="mt-move"
                  value=""
                  disabled={!targets.length}
                  onChange={(e) => e.target.value && act("move", targets, e.target.value)}
                  className="bg-transparent text-[13.5px] outline-none disabled:opacity-40"
                >
                  <option value="">Move to</option>
                  {moveTargets.map((f) => (
                    <option key={f.path} value={f.path}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </span>
              <Sep />
              <RibbonBtn disabled={!message} onClick={() => message && compose(replyDraft(latestFromOthers(), email, false))} icon={<Reply size={17} />}>
                Reply
              </RibbonBtn>
              <RibbonBtn disabled={!message} onClick={() => message && compose(replyDraft(latestFromOthers(), email, true))} icon={<ReplyAll size={17} />}>
                Reply all
              </RibbonBtn>
              <RibbonBtn disabled={!message} onClick={() => message && compose(forwardDraft(message))} icon={<Forward size={17} />}>
                Forward
              </RibbonBtn>
              <Sep />
              <RibbonBtn disabled={!targets.length} onClick={() => act(allTargetsRead ? "unread" : "read", targets)} icon={<EnvelopeOpen size={17} />}>
                {allTargetsRead ? "Mark unread" : "Mark read"}
              </RibbonBtn>
              <RibbonBtn disabled={!targets.length} onClick={() => act(allTargetsStarred ? "unflag" : "flag", targets)} icon={<Star size={17} filled={allTargetsStarred} />}>
                {allTargetsStarred ? "Unstar" : "Star"}
              </RibbonBtn>
            </>
          )}
          {tab === "View" && (
            <>
              <RibbonBtn onClick={() => setPaneOpen((v) => !v)} icon={<Menu size={17} />}>
                {paneOpen ? "Hide folder pane" : "Show folder pane"}
              </RibbonBtn>
              <RibbonBtn onClick={() => setGrouping(!grouping)} icon={<EnvelopeOpen size={17} />}>
                {grouping ? "Show emails one by one" : "Group into conversations"}
              </RibbonBtn>
              <RibbonBtn onClick={() => { loadList(); loadFolders(); }} icon={<Refresh size={17} />}>
                Refresh
              </RibbonBtn>
            </>
          )}
          {tab === "Help" && (
            <span className="flex h-[34px] items-center px-2 text-[13px] text-ink-soft">
              Shortcuts: c new email, / search, j and k next and previous, e archive, # delete. MailTide {build}
            </span>
          )}
        </div>
        {newMenu && (
          <div className="relative">
            <div className="absolute left-0 top-1 z-20 flex w-[200px] flex-col rounded-xl border border-line bg-white p-1.5 shadow-lg">
              <button onClick={() => { setNewMenu(false); setDraft({}); }} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-paper">
                <Mail size={16} /> Email
              </button>
              <a href="/calendar?new=1" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink no-underline hover:bg-paper">
                <CalendarIcon size={16} /> Event
              </a>
            </div>
          </div>
        )}
      </div>

      <div className="mt-2 flex min-h-0 flex-1">
        {/* Folder pane */}
        {drawer && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setDrawer(false)} />}
        <nav
          aria-label="Folders"
          className={`scroll-thin fixed inset-y-0 left-0 z-40 w-[248px] flex-col gap-0.5 overflow-y-auto bg-bg px-2 pb-3 pt-2 transition-transform lg:static lg:z-auto lg:w-[236px] lg:flex-none lg:translate-x-0 ${
            drawer ? "flex translate-x-0" : "flex -translate-x-full"
          } ${paneOpen ? "" : "lg:hidden"}`}
        >
          <button onClick={() => (drawer ? setDrawer(false) : setPaneOpen(false))} aria-label="Collapse folders" className="mb-1 ml-1 flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/70">
            <Menu size={18} />
          </button>
          {folders.length === 0 && <span className="px-3 py-2 text-[13px] text-muted">Loading folders...</span>}
          {!mbox && favorites.length > 0 && section("Favorites", favOpen, () => setFavOpen((v) => !v))}
          {!mbox && favOpen && favorites.map((f) => folderButton(f, `fav:${f.path}`))}
          {section(email, !mbox && acctOpen, () => (mbox ? switchMailbox(null) : setAcctOpen((v) => !v)))}
          {!mbox && acctOpen && folders.map((f) => folderButton(f, f.path))}
          {shared.map((x) => {
            const on = mbox === x.address;
            return (
              <div key={x.address}>
                <button onClick={() => (on ? null : switchMailbox(x.address))} aria-expanded={on} className="flex w-full items-center gap-1.5 px-2 pb-1 pt-3.5 text-left text-[13px] font-semibold text-ink-soft">
                  {on ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span className="flex-1 truncate">{x.name}</span>
                  <span className="rounded-[5px] bg-[#DDE7F3] px-1.5 text-[11px] font-semibold text-[#2F5B8A]">Shared</span>
                </button>
                {on && (
                  <>
                    <span className="block truncate pb-1.5 pl-7 pr-3 text-xs text-muted">{x.address}</span>
                    {folders.map((f) => folderButton(f, `${x.address}:${f.path}`))}
                    <div className="mx-1.5 mt-3.5 rounded-[10px] border border-line bg-paper px-3 py-2.5 text-[12.5px] leading-snug text-ink-soft">
                      Your access: <b>{x.access === "full" ? "Full" : x.access === "sendas" ? "Send as" : "Read"}</b>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </nav>
        {!paneOpen && (
          <button onClick={() => setPaneOpen(true)} aria-label="Show folders" className="ml-1 hidden h-9 w-9 flex-none items-center justify-center rounded-lg hover:bg-white/70 lg:flex">
            <Menu size={18} />
          </button>
        )}

        {/* Message list */}
        <section
          aria-label="Message list"
          className={`flex min-w-0 flex-1 flex-col border-x border-line bg-white md:max-w-[440px] md:flex-none md:basis-[400px] ${selected ? "hidden md:flex" : "flex"}`}
        >
          <div className="flex items-center gap-1 px-3 pb-1.5 pt-2.5">
            <input
              type="checkbox"
              aria-label="Select all"
              checked={allChecked}
              onChange={() => setChecked(allChecked ? new Set() : new Set(rows.map((r) => r.uid)))}
              className="mx-1.5 h-4 w-4 accent-[#E8693A]"
            />
            {checked.size > 0 ? (
              <span className="flex-1 truncate px-1 text-sm font-semibold">{checked.size} selected</span>
            ) : (
              <>
                {sharedBox && <b className="mr-1 truncate font-head text-[15px] font-semibold">{sharedBox.name}</b>}
                {(
                  [
                    ["All", false, false],
                    ["Unread", true, false],
                    ...(sharedBox ? [["Not replied", false, true]] : []),
                  ] as [string, boolean, boolean][]
                ).map(([label, val, nr]) => {
                  const on = nr ? notReplied : !notReplied && unreadOnly === val;
                  return (
                    <button
                      key={label}
                      onClick={() => {
                        setUnreadOnly(val);
                        setNotReplied(nr);
                        setPage(1);
                      }}
                      className={`whitespace-nowrap px-2 py-1.5 text-[14.5px] ${on ? "font-semibold shadow-[inset_0_-2px_0_#E8693A]" : "text-muted hover:text-ink"}`}
                    >
                      {label}
                    </button>
                  );
                })}
                <span className="flex-1 truncate pl-2 text-right text-[12.5px] text-muted">
                  {title} · {total}
                </span>
              </>
            )}
            <button onClick={() => { loadList(); loadFolders(); }} aria-label="Refresh" title="Refresh" className="rounded-lg p-2 text-muted hover:bg-bg hover:text-ink">
              <Refresh size={16} />
            </button>
          </div>

          <div className="scroll-thin flex-1 overflow-y-auto">
            {loading && rows.length === 0 && <ListSkeleton />}
            {listError && (
              <div className="m-4 rounded-xl border border-orange-line bg-orange-soft p-3 text-[13px] text-orange-text">
                {listError}{" "}
                <button className="ml-1 font-semibold underline" onClick={() => loadList()}>
                  Try again
                </button>
              </div>
            )}
            {!loading && !listError && rows.length === 0 && (
              <div className="flex flex-col items-center gap-1 px-6 py-16 text-center">
                <b className="font-head text-[15px]">{activeQuery ? "No emails match your search" : unreadOnly ? "You're all caught up" : "Nothing here yet"}</b>
                <span className="text-[13px] text-muted">{activeQuery ? "Try other words, a name or an email address." : "New emails will show up here."}</span>
              </div>
            )}
            {groups.map((g) => {
              const closed = closedGroups.has(g.label);
              return (
                <div key={g.label}>
                  <button
                    onClick={() =>
                      setClosedGroups((s) => {
                        const n = new Set(s);
                        if (n.has(g.label)) n.delete(g.label);
                        else n.add(g.label);
                        return n;
                      })
                    }
                    aria-expanded={!closed}
                    className="flex w-full items-center gap-1.5 border-t border-line-faint px-3.5 pb-1.5 pt-2.5 text-left text-[13px] font-semibold text-ink-soft"
                  >
                    {closed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                    {g.label}
                  </button>
                  {!closed &&
                    g.rows.map((m) => {
                      const who = role === "sent" || role === "drafts" ? m.to[0] : m.from[0];
                      const [bg, fg] = avatarColors(who?.address || "?");
                      const isSel = m.uid === selected || (m.uids ?? []).includes(selected ?? -1);
                      const count = m.count ?? 1;
                      const open = expanded.has(m.uid);
                      return (
                        <div key={m.uid} className="border-t border-line-faint">
                          <div
                            className={`group flex cursor-pointer gap-2 py-[11px] pl-1.5 pr-3.5 ${
                              isSel ? "bg-[#FBF3EE] shadow-[inset_3px_0_0_#E8693A]" : !m.seen ? "bg-white shadow-[inset_3px_0_0_#E8693A] hover:bg-paper" : "bg-white hover:bg-paper"
                            }`}
                            onClick={() => (role === "drafts" ? openDraft(m.uid) : open_(m.uid))}
                          >
                            {count > 1 ? (
                              <button
                                aria-label={open ? "Collapse conversation" : "Expand conversation"}
                                aria-expanded={open}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpanded((s) => {
                                    const n = new Set(s);
                                    if (n.has(m.uid)) n.delete(m.uid);
                                    else n.add(m.uid);
                                    return n;
                                  });
                                }}
                                className="flex h-9 w-[18px] flex-none items-center justify-center text-muted hover:text-ink"
                              >
                                {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </button>
                            ) : (
                              <span className="w-[18px] flex-none" />
                            )}
                            <div className="relative flex-none">
                              <div
                                className="flex h-9 w-9 items-center justify-center rounded-full font-head text-[12.5px] font-semibold group-hover:hidden"
                                style={{ background: bg, color: fg, display: checked.has(m.uid) ? "none" : undefined }}
                              >
                                {initials(who)}
                              </div>
                              <label className={`h-9 w-9 items-center justify-center ${checked.has(m.uid) ? "flex" : "hidden group-hover:flex"}`} onClick={(e) => e.stopPropagation()}>
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
                            <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
                              <div className="flex items-baseline gap-2">
                                <b className={`flex-1 truncate text-sm text-ink ${m.seen ? "font-normal" : "font-semibold"}`}>
                                  {role === "sent" || role === "drafts" ? `To: ${displayName(who)}` : displayName(who)}
                                </b>
                                {count > 1 && (
                                  <span className="flex-none rounded-[5px] bg-sand px-1.5 text-[11px] font-bold leading-[17px] text-muted" aria-label={`${count} emails in this conversation`}>
                                    {count}
                                  </span>
                                )}
                                {m.attachments && <Clip size={13} className="flex-none text-muted" />}
                              </div>
                              <div className="flex items-baseline gap-2">
                                <span className={`flex-1 truncate text-[13.5px] ${m.seen ? "font-normal text-ink" : "font-semibold text-orange-text"}`}>{m.subject}</span>
                                <span className="flex-none text-[12.5px] text-muted">{shortDate(m.date)}</span>
                              </div>
                              {(() => {
                                const st = teamStatus(m.key, m.answered);
                                if (!st) return null;
                                const tone = st.tone === "done" ? "bg-[#E4F0E6] text-[#2C6B3A]" : st.tone === "busy" ? "bg-[#DDE7F3] text-[#2F5B8A]" : "bg-orange-soft text-orange-text";
                                return <span className={`order-last w-fit rounded-[5px] px-1.5 text-[11.5px] font-semibold leading-[18px] ${tone}`}>{st.text}</span>;
                              })()}
                              <div className="flex items-center gap-2">
                                <span className="flex-1 truncate text-[13px] text-muted">{m.snippet}</span>
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
                          {open &&
                            (m.members ?? []).map((x) => (
                              <button
                                key={x.uid}
                                onClick={() => open_(x.uid)}
                                className={`flex w-full items-baseline gap-2 border-t border-line-faint py-2 pl-[70px] pr-3.5 text-left text-[13px] hover:bg-paper ${x.uid === selected ? "bg-[#FBF3EE]" : ""}`}
                              >
                                <span className={`w-[120px] flex-none truncate ${x.seen ? "" : "font-semibold"}`}>{displayName(x.from[0])}</span>
                                <span className="flex-1 truncate text-muted">{x.snippet}</span>
                                <span className="flex-none text-xs text-muted">{shortDate(x.date)}</span>
                              </button>
                            ))}
                        </div>
                      );
                    })}
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

        {/* Reading pane */}
        <main className={`min-w-0 flex-1 flex-col ${selected ? "flex" : "hidden md:flex"}`}>
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
            onCompose={compose}
            shared={sharedBox ? { name: sharedBox.name, address: sharedBox.address, canSend } : null}
            othersReplying={othersReplying.map((r) => ({ name: r.name, since: r.started_at || "" }))}
            sendQuery={sharedBox && canSend ? `?mbox=${encodeURIComponent(sharedBox.address)}` : ""}
            threadKey={selectedKey}
            onReplying={() => {
              if (sharedBox && canSend && selectedKey)
                api(`/api/presence?mbox=${encodeURIComponent(sharedBox.address)}`, { method: "POST", body: JSON.stringify({ thread: selectedKey, state: "start" }) }).catch(() => null);
            }}
            onSent={() => {
              flash("Sent");
              loadFolders();
            }}
            onError={(t) => flash(t, "error")}
          />
        </main>
      </div>

      {draft && (
        <Composer
          initial={draft}
          fromOptions={fromOptions}
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
          className={`fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl px-4 py-2.5 text-[13.5px] font-medium shadow-lg ${toast.tone === "ok" ? "bg-ink text-white" : "bg-orange-text text-white"}`}
        >
          {toast.text}
        </div>
      )}
    </Shell>
  );

  function latestFromOthers(): FullMessage {
    const msgs = thread.length ? thread : message ? [message] : [];
    return msgs.find((x) => !x.from.some((a) => a.address.toLowerCase() === email.toLowerCase())) || (message as FullMessage);
  }

  async function openDraft(uid: number) {
    try {
      const m = await api<FullMessage>(box(`/api/messages/${uid}?folder=${encodeURIComponent(folder)}`));
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

function Sep() {
  return <span className="mx-1 h-[22px] w-px flex-none bg-line-strong" />;
}

function RibbonBtn({ children, onClick, icon, disabled }: { children: React.ReactNode; onClick: () => void; icon: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex h-[34px] flex-none items-center gap-1.5 rounded-lg px-2 text-[13.5px] text-ink hover:bg-bg disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
    >
      {icon}
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
