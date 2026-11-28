"use client";
import { useEffect, useRef, useState } from "react";
import { api, fileSize, splitAddresses, type Attachment } from "@/lib/client";
import { askConfirm } from "./Dialogs";
import { Clip, Close, Send } from "./Icons";

export type Draft = {
  to?: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  text?: string;
  inReplyTo?: string;
  references?: string[];
  replyToUid?: number;
  replyFolder?: string;
  draftUid?: number;
  forwardAttachments?: Attachment[];
  /** Send from this address (a shared mailbox the person may send as). */
  from?: string;
  /** Conversation key, so a shared mailbox can show who replied. */
  threadKey?: string;
};

export type FromOption = { address: string; label: string };

type FileItem = { filename: string; contentType: string; size: number; data: string };

const MAX = 20 * 1024 * 1024;

function toBase64(buf: ArrayBuffer): string {
  let bin = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export default function Composer({
  initial,
  onClose,
  onDone,
  fromOptions = [],
}: {
  initial: Draft;
  onClose: () => void;
  onDone: (mode: "send" | "draft") => void;
  fromOptions?: FromOption[];
}) {
  const [from, setFrom] = useState(initial.from || fromOptions[0]?.address || "");
  const [to, setTo] = useState(initial.to ?? "");
  const [cc, setCc] = useState(initial.cc ?? "");
  const [bcc, setBcc] = useState(initial.bcc ?? "");
  const [showCc, setShowCc] = useState(!!(initial.cc || initial.bcc));
  const [subject, setSubject] = useState(initial.subject ?? "");
  const [text, setText] = useState(initial.text ?? "");
  const [files, setFiles] = useState<FileItem[]>([]);
  const [busy, setBusy] = useState<"" | "send" | "draft">("");
  const [error, setError] = useState("");
  const body = useRef<HTMLTextAreaElement>(null);
  const toRef = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  // Only what the person changed counts: a composer opened with a recipient or a quoted reply is not dirty yet.
  const dirty =
    to.trim() !== (initial.to ?? "").trim() ||
    cc.trim() !== (initial.cc ?? "").trim() ||
    bcc.trim() !== (initial.bcc ?? "").trim() ||
    subject.trim() !== (initial.subject ?? "").trim() ||
    text.trim() !== (initial.text ?? "").trim() ||
    files.length > (initial.forwardAttachments?.length ?? 0);

  useEffect(() => {
    if (initial.to) {
      body.current?.focus();
      body.current?.setSelectionRange(0, 0);
    } else toRef.current?.focus();
  }, [initial.to]);

  // Bring along the original attachments when forwarding.
  useEffect(() => {
    if (!initial.forwardAttachments?.length) return;
    (async () => {
      const got: FileItem[] = [];
      for (const a of initial.forwardAttachments!) {
        try {
          const r = await fetch(`${a.url}&download=1`);
          got.push({ filename: a.filename, contentType: a.contentType, size: a.size, data: toBase64(await r.arrayBuffer()) });
        } catch {
          /* skip one that cannot be fetched */
        }
      }
      setFiles((f) => [...f, ...got]);
    })();
  }, [initial.forwardAttachments]);

  async function addFiles(list: FileList | null) {
    if (!list) return;
    const next: FileItem[] = [];
    let total = files.reduce((s, f) => s + f.size, 0);
    for (const f of Array.from(list)) {
      total += f.size;
      if (total > MAX) {
        setError("Attachments can be up to 20 MB in total.");
        break;
      }
      next.push({ filename: f.name, contentType: f.type || "application/octet-stream", size: f.size, data: toBase64(await f.arrayBuffer()) });
    }
    setFiles((cur) => [...cur, ...next]);
  }

  async function submit(mode: "send" | "draft") {
    setError("");
    const toList = splitAddresses(to);
    const ccList = splitAddresses(cc);
    const bccList = splitAddresses(bcc);
    if (mode === "send" && toList.length + ccList.length + bccList.length === 0) {
      setError("Add at least one recipient.");
      return;
    }
    if (mode === "send" && !subject.trim() && !(await askConfirm({ title: "Send without a subject?", confirmLabel: "Send anyway" }))) return;
    setBusy(mode);
    try {
      const own = !from || from === fromOptions[0]?.address;
      await api(own ? "/api/send" : `/api/send?mbox=${encodeURIComponent(from)}`, {
        method: "POST",
        body: JSON.stringify({
          mode,
          to: toList,
          cc: ccList,
          bcc: bccList,
          subject,
          text,
          inReplyTo: initial.inReplyTo,
          references: initial.references,
          replyToUid: initial.replyToUid,
          replyFolder: initial.replyFolder,
          draftUid: initial.draftUid,
          threadKey: own ? undefined : initial.threadKey,
          attachments: files.map(({ filename, contentType, data }) => ({ filename, contentType, data })),
        }),
      });
      onDone(mode);
    } catch (e) {
      setError((e as Error).message);
      setBusy("");
    }
  }

  async function close() {
    if (dirty && !(await askConfirm({ title: "Discard this email?", message: "What you wrote will be lost.", confirmLabel: "Discard", danger: true }))) return;
    onClose();
  }

  const field = "min-w-0 flex-1 bg-transparent py-2.5 text-sm text-ink outline-none";
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 md:items-end md:justify-end md:bg-transparent md:p-6 md:pointer-events-none">
      <div
        role="dialog"
        aria-label="New email"
        className="pointer-events-auto flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-[0_24px_60px_-20px_rgba(42,36,32,.45)] md:h-[640px] md:max-h-[calc(100vh-48px)] md:w-[620px] md:rounded-2xl md:border md:border-line"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit("send");
          if (e.key === "Escape") close();
        }}
      >
        <div className="espresso flex items-center gap-2 px-4 py-3 text-white">
          <b className="font-head flex-1 text-[14px] font-semibold">{initial.replyToUid ? "Reply" : initial.draftUid ? "Draft" : subject.startsWith("Fwd") ? "Forward" : "New email"}</b>
          <button onClick={close} aria-label="Close" className="rounded-md p-1 text-espresso-dim hover:bg-white/10 hover:text-white">
            <Close size={17} />
          </button>
        </div>
        <div className="flex flex-col border-b border-line px-4">
          {fromOptions.length > 1 && (
            <div className="flex items-center gap-2 border-b border-line-faint py-1.5">
              <label htmlFor="mt-from" className="w-12 text-[13px] text-muted">From</label>
              <select id="mt-from" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 min-w-0 flex-1 rounded-lg border border-line-strong bg-white px-2 text-[13.5px]">
                {fromOptions.map((o) => (
                  <option key={o.address} value={o.address}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-center gap-2 border-b border-line-faint">
            <label htmlFor="mt-to" className="w-12 text-[13px] text-muted">To</label>
            <input id="mt-to" ref={toRef} className={field} value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@company.com, ..." autoComplete="email" />
            {!showCc && (
              <button onClick={() => setShowCc(true)} className="text-[12.5px] font-medium text-muted hover:text-ink">
                Cc Bcc
              </button>
            )}
          </div>
          {showCc && (
            <>
              <div className="flex items-center gap-2 border-b border-line-faint">
                <label htmlFor="mt-cc" className="w-12 text-[13px] text-muted">Cc</label>
                <input id="mt-cc" className={field} value={cc} onChange={(e) => setCc(e.target.value)} />
              </div>
              <div className="flex items-center gap-2 border-b border-line-faint">
                <label htmlFor="mt-bcc" className="w-12 text-[13px] text-muted">Bcc</label>
                <input id="mt-bcc" className={field} value={bcc} onChange={(e) => setBcc(e.target.value)} />
              </div>
            </>
          )}
          <div className="flex items-center gap-2">
            <label htmlFor="mt-subject" className="w-12 text-[13px] text-muted">Subject</label>
            <input id="mt-subject" className={`${field} font-semibold`} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
        </div>
        <label htmlFor="mt-body" className="sr-only">Message</label>
        <textarea
          id="mt-body"
          ref={body}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="scroll-thin min-h-0 flex-1 resize-none px-4 py-3 text-sm leading-relaxed text-ink outline-none focus-visible:outline-none"
          placeholder="Write your message"
        />
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 pb-2">
            {files.map((f, i) => (
              <span key={i} className="flex items-center gap-2 rounded-lg border border-line bg-paper py-1 pl-2.5 pr-1 text-[12.5px]">
                <span className="max-w-[180px] truncate font-medium">{f.filename}</span>
                <span className="text-muted">{fileSize(f.size)}</span>
                <button aria-label={`Remove ${f.filename}`} onClick={() => setFiles(files.filter((_, j) => j !== i))} className="rounded p-0.5 text-muted hover:bg-sand hover:text-ink">
                  <Close size={13} />
                </button>
              </span>
            ))}
          </div>
        )}
        {error && (
          <div role="alert" className="mx-4 mb-2 rounded-lg border border-orange-line bg-orange-soft px-3 py-2 text-[13px] text-orange-text">
            {error}
          </div>
        )}
        <div className="flex items-center gap-2 border-t border-line px-4 py-3">
          <button
            disabled={!!busy}
            onClick={() => submit("send")}
            className="flex h-10 items-center gap-2 rounded-[10px] bg-orange px-5 text-[13.5px] font-semibold text-white hover:bg-orange-press disabled:opacity-60"
          >
            <Send size={15} /> {busy === "send" ? "Sending..." : "Send"}
          </button>
          <button
            disabled={!!busy}
            onClick={() => submit("draft")}
            className="h-10 rounded-[10px] border border-line-strong px-3.5 text-[13px] font-medium text-ink hover:bg-bg disabled:opacity-60"
          >
            {busy === "draft" ? "Saving..." : "Save draft"}
          </button>
          <input ref={fileInput} type="file" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          <button onClick={() => fileInput.current?.click()} aria-label="Attach files" title="Attach files" className="rounded-lg p-2.5 text-muted hover:bg-bg hover:text-ink">
            <Clip size={17} />
          </button>
          <div className="flex-1" />
          <span className="hidden text-xs text-muted md:inline">Ctrl+Enter to send</span>
        </div>
      </div>
    </div>
  );
}
