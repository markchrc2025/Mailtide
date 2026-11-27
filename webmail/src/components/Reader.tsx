"use client";
import { useEffect, useRef, useState } from "react";
import {
  api,
  avatarColors,
  displayName,
  fileSize,
  formatAddress,
  initials,
  longDate,
  shortDate,
  prefixSubject,
  quoteText,
  type Folder,
  type FullMessage,
} from "@/lib/client";
import { Archive, Back, Clip, Forward, Mail, Reply, ReplyAll, Spam, Star, Trash } from "./Icons";
import { LogoMark } from "./Logo";
import type { Draft } from "./Composer";
import { hasQuote } from "@/lib/thread";

type Props = {
  message: FullMessage | null;
  thread: FullMessage[];
  loading: boolean;
  role: string;
  folders: Folder[];
  onBack: () => void;
  onAction: (action: string, target?: string) => void;
  onCompose: (d: Draft) => void;
  onSent: () => void;
  onError: (text: string) => void;
};

export function replyDraft(m: FullMessage, me: string, all: boolean): Draft {
  const replyTo = (m.replyTo.length ? m.replyTo : m.from).map((a) => a.address);
  const others = all ? [...m.to, ...m.cc].map((a) => a.address).filter((a) => a.toLowerCase() !== me.toLowerCase() && !replyTo.includes(a)) : [];
  return {
    to: replyTo.join(", "),
    cc: others.join(", "),
    subject: prefixSubject("Re", m.subject),
    text: quoteText(m),
    inReplyTo: m.messageId ?? undefined,
    references: [...m.references, ...(m.messageId ? [m.messageId] : [])],
    replyToUid: m.uid,
    replyFolder: m.folder,
  };
}

export function forwardDraft(m: FullMessage): Draft {
  const head = [
    "---------- Forwarded message ----------",
    `From: ${m.from.map(formatAddress).join(", ")}`,
    `Date: ${longDate(m.date)}`,
    `Subject: ${m.subject}`,
    `To: ${m.to.map(formatAddress).join(", ")}`,
  ].join("\n");
  return { subject: prefixSubject("Fwd", m.subject), text: `\n\n${head}\n\n${m.text}`, forwardAttachments: m.attachments };
}

export default function Reader({ message: m, thread, loading, role, folders, onBack, onAction, onCompose, onSent, onError }: Props) {
  const [quick, setQuick] = useState("");
  const [sending, setSending] = useState(false);
  const [me, setMe] = useState("");

  useEffect(() => {
    api<{ email: string }>("/api/me").then((r) => setMe(r.email)).catch(() => null);
  }, []);

  useEffect(() => {
    setQuick("");
  }, [m?.uid]);

  if (loading && !m) {
    return (
      <div className="flex flex-1 items-center justify-center text-[13px] text-muted">Opening email...</div>
    );
  }
  if (!m) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <div className="tile flex h-14 w-14 items-center justify-center rounded-2xl">
          <LogoMark size={30} />
        </div>
        <b className="font-head text-[17px]">Pick an email to read</b>
        <span className="max-w-[280px] text-[13px] text-muted">
          Shortcuts: <kbd className="font-semibold">c</kbd> new email, <kbd className="font-semibold">/</kbd> search, <kbd className="font-semibold">j</kbd>/<kbd className="font-semibold">k</kbd> next and previous.
        </span>
      </div>
    );
  }

  const moveTargets = folders.filter((f) => f.path !== m.folder);
  const msgs = thread.length ? thread : [m];
  const mine = (x: FullMessage) => !!me && x.from.some((a) => a.address.toLowerCase() === me.toLowerCase());
  // Quick reply answers the newest message someone else sent, like Outlook.
  const replyBase = msgs.find((x) => !mine(x)) || msgs[0];
  const replySender = replyBase.from[0];

  async function sendQuick() {
    if (!quick.trim()) return;
    setSending(true);
    const d = replyDraft(replyBase, me, false);
    try {
      await api("/api/send", {
        method: "POST",
        body: JSON.stringify({
          to: (d.to || "").split(",").map((s) => s.trim()).filter(Boolean),
          subject: d.subject,
          text: quick + (d.text || ""),
          inReplyTo: d.inReplyTo,
          references: d.references,
          replyToUid: d.replyToUid,
          replyFolder: d.replyFolder,
        }),
      });
      setQuick("");
      onSent();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  const btn = "flex h-9 items-center gap-1.5 rounded-[9px] border border-line bg-white px-3 text-[13px] font-medium text-ink hover:bg-bg";
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="scroll-thin flex items-center gap-1.5 overflow-x-auto border-b border-line bg-white px-3 py-3 md:hidden">
        <button onClick={onBack} aria-label="Back to list" className="rounded-lg p-2 text-ink hover:bg-bg md:hidden">
          <Back />
        </button>
        {role !== "archive" && (
          <button className={btn} onClick={() => onAction("archive")} title="Archive (e)">
            <Archive size={15} /> <span className="hidden sm:inline">Archive</span>
          </button>
        )}
        <button className={btn} onClick={() => onAction("trash")} title="Delete (#)">
          <Trash size={15} /> <span className="hidden sm:inline">{role === "trash" ? "Delete for good" : "Delete"}</span>
        </button>
        <button className={btn} onClick={() => onAction(role === "junk" ? "notspam" : "spam")}>
          <Spam size={15} /> <span className="hidden sm:inline">{role === "junk" ? "Not spam" : "Spam"}</span>
        </button>
        <button className={btn} onClick={() => onAction("unread")}>
          <Mail size={15} /> <span className="hidden lg:inline">Mark unread</span>
        </button>
        <label className="sr-only" htmlFor="mt-move">Move to folder</label>
        <select
          id="mt-move"
          value=""
          onChange={(e) => e.target.value && onAction("move", e.target.value)}
          className="h-9 rounded-[9px] border border-line bg-white px-2 text-[13px] font-medium text-ink"
        >
          <option value="">Move to...</option>
          {moveTargets.map((f) => (
            <option key={f.path} value={f.path}>
              {f.name}
            </option>
          ))}
        </select>
        <div className="flex-1" />
        <button
          className={`${btn} ${m.flagged ? "text-[#C7913D]" : ""}`}
          onClick={() => onAction(m.flagged ? "unflag" : "flag")}
          aria-label={m.flagged ? "Unstar" : "Star"}
        >
          <Star size={15} filled={m.flagged} />
        </button>
      </div>

      <div className="scroll-thin flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[880px] flex-col gap-4 px-4 py-6 md:px-7">
          <h1 className="font-head m-0 text-[20px] font-semibold leading-snug tracking-tight md:text-[22px]">{m.subject}</h1>

          {msgs.length > 1 && (
            <span className="-mt-2 text-[12.5px] text-muted">{msgs.length} messages in this conversation, newest first</span>
          )}
          {msgs.map((x, i) => (
            <MessageCard
              key={`${x.folder}:${x.uid}`}
              m={x}
              me={me}
              openFolder={m.folder}
              defaultOpen={i === 0 || (x.uid === m.uid && x.folder === m.folder) || !!x.unread}
              onCompose={onCompose}
            />
          ))}

          {role !== "sent" && role !== "drafts" && (
            <div className="flex flex-wrap items-center gap-2.5 rounded-[14px] border border-line bg-white px-3.5 py-3">
              <label htmlFor="mt-quick" className="sr-only">Quick reply</label>
              <input
                id="mt-quick"
                value={quick}
                onChange={(e) => setQuick(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.metaKey || e.ctrlKey) && sendQuick()}
                placeholder={`Reply to ${displayName(replySender)}`}
                className="h-10 min-w-[200px] flex-1 bg-transparent text-sm text-ink outline-none"
              />
              <button
                onClick={() => onCompose({ ...replyDraft(replyBase, me, false), text: quick + quoteText(replyBase) })}
                className="flex h-[38px] items-center gap-1.5 rounded-[9px] border border-line px-3 text-[13px] font-medium text-ink hover:bg-bg"
              >
                <Clip size={14} /> Full editor
              </button>
              <button
                disabled={!quick.trim() || sending}
                onClick={sendQuick}
                className="h-[38px] rounded-[9px] bg-orange px-4 text-[13px] font-semibold text-white hover:bg-orange-press disabled:opacity-50"
              >
                {sending ? "Sending..." : "Send"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const QUOTE_CSS = `.mt-quote,.gmail_quote,.gmail_quote_container,.moz-cite-prefix,.yahoo_quoted,blockquote,#divRplyFwdMsg,#divRplyFwdMsg~*,#appendonsend~*,hr#stopSpelling~*{display:none}`;

function MessageCard({
  m,
  me,
  openFolder,
  defaultOpen,
  onCompose,
}: {
  m: FullMessage;
  me: string;
  openFolder: string;
  defaultOpen: boolean;
  onCompose: (d: Draft) => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [open, setOpen] = useState(defaultOpen);
  const [showQuote, setShowQuote] = useState(false);
  const [height, setHeight] = useState(120);
  const sender = m.from[0];
  const [bg, fg] = avatarColors(sender?.address || "?");
  const btn = "flex h-9 items-center gap-1.5 rounded-[9px] border border-line bg-white px-3 text-[13px] font-medium text-ink hover:bg-bg";
  const quoted = hasQuote(m.html);
  const toLine = m.to.map((a) => (me && a.address.toLowerCase() === me.toLowerCase() ? "me" : displayName(a))).join(", ") || "undisclosed";
  const srcDoc = `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>
    body{margin:0;font-family:'Hanken Grotesk',Arial,sans-serif;font-size:14px;line-height:1.6;color:#2A2420;word-wrap:break-word;overflow-wrap:anywhere}
    img{max-width:100%;height:auto} a{color:#B04A22} blockquote{margin:0 0 0 .6em;padding-left:.8em;border-left:3px solid #ECE6DD;color:#6B6259}
    pre{white-space:pre-wrap} table{max-width:100%} p{margin:0 0 .7em}
    ${showQuote ? "" : QUOTE_CSS}
  </style></head><body>${m.html}</body></html>`;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-[11px] rounded-[14px] border border-line bg-white px-4 py-3 text-left hover:border-orange-line md:px-5"
        aria-label={`Open message from ${displayName(sender)}`}
      >
        <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full font-head text-[12px] font-semibold" style={{ background: bg, color: fg }}>
          {initials(sender)}
        </div>
        <div className="flex min-w-0 flex-1 flex-col leading-snug">
          <span className="flex items-center gap-2">
            <b className={`truncate text-sm ${m.unread ? "font-bold" : "font-semibold"}`}>{displayName(sender)}</b>
            {m.folder !== openFolder && <span className="rounded-md bg-sand px-1.5 text-[11px] text-muted">{m.folder === "INBOX" ? "Inbox" : m.folder}</span>}
          </span>
          <span className="truncate text-[12.5px] text-muted">{(m.text || "").replace(/\s+/g, " ").replace(/On .{5,120} wrote:.*$/, "").trim().slice(0, 140) || "(no text)"}</span>
        </div>
        <span className="flex-none text-xs text-muted">{shortDate(m.date)}</span>
      </button>
    );
  }

  return (
    <article className="flex flex-col gap-3 rounded-[14px] border border-line bg-white px-4 py-4 md:px-5">
      <div className="flex items-center gap-[11px]">
        <button onClick={() => setOpen(false)} aria-label="Collapse message" className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full font-head text-[13px] font-semibold" style={{ background: bg, color: fg }}>
          {initials(sender)}
        </button>
        <div className="flex min-w-0 flex-1 flex-col leading-snug">
          <span className="flex items-center gap-2">
            <b className="truncate text-sm font-semibold">{displayName(sender)}</b>
            {m.folder !== openFolder && <span className="rounded-md bg-sand px-1.5 text-[11px] text-muted">{m.folder === "INBOX" ? "Inbox" : m.folder}</span>}
          </span>
          <span className="truncate text-[12.5px] text-muted" title={[...m.to, ...m.cc].map(formatAddress).join(", ")}>
            {sender?.address} · to {toLine}
            {m.cc.length > 0 && `, cc ${m.cc.map(displayName).join(", ")}`}
          </span>
        </div>
        <span className="flex-none text-xs text-muted">{longDate(m.date)}</span>
      </div>
      <iframe
        ref={frame}
        title={`Email from ${displayName(sender)}`}
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        srcDoc={srcDoc}
        className="w-full border-0"
        style={{ height }}
        onLoad={() => {
          const doc = frame.current?.contentDocument;
          if (doc) setHeight(Math.max(24, Math.min(20000, doc.documentElement.scrollHeight + 4)));
        }}
      />
      {quoted && (
        <button
          onClick={() => setShowQuote((v) => !v)}
          className="-mt-1 w-fit rounded-md bg-sand px-2 text-[13px] font-bold leading-5 tracking-widest text-muted hover:bg-line"
          aria-label={showQuote ? "Hide earlier messages" : "Show earlier messages"}
          title={showQuote ? "Hide earlier messages" : "Show earlier messages"}
        >
          •••
        </button>
      )}
      {m.attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {m.attachments.map((a) => (
            <a
              key={a.index}
              href={`${a.url}&download=1`}
              className="flex items-center gap-2.5 rounded-[10px] border border-line bg-paper px-3 py-2 text-ink no-underline hover:border-orange-line"
            >
              <span className="flex h-9 w-[30px] items-center justify-center rounded-[5px] bg-[#F3D9CC] text-[10px] font-bold uppercase text-orange-text">
                {(a.filename.split(".").pop() || "file").slice(0, 4)}
              </span>
              <span className="flex flex-col leading-tight">
                <b className="max-w-[220px] truncate text-[12.5px] font-semibold">{a.filename}</b>
                <span className="text-[11.5px] text-muted">{fileSize(a.size)}</span>
              </span>
            </a>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2 border-t border-line-faint pt-3">
        <button className={btn} onClick={() => onCompose(replyDraft(m, me, false))}>
          <Reply size={15} /> Reply
        </button>
        {m.to.length + m.cc.length > 1 && (
          <button className={btn} onClick={() => onCompose(replyDraft(m, me, true))}>
            <ReplyAll size={15} /> Reply all
          </button>
        )}
        <button className={btn} onClick={() => onCompose(forwardDraft(m))}>
          <Forward size={15} /> Forward
        </button>
      </div>
    </article>
  );
}
