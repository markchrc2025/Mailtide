"use client";

import { useEffect, useRef, useState } from "react";

// In-app replacements for the browser's own confirm() and prompt() boxes (MTD-101).
// Call askConfirm() or askText() from anywhere; <DialogHost /> in the root layout draws them.

type Ask = {
  kind: "confirm" | "text";
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  placeholder?: string;
  resolve: (v: boolean | string | null) => void;
};

let show: ((a: Ask) => void) | null = null;

type ConfirmOptions = { title: string; message?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean };
type TextOptions = { title: string; message?: string; placeholder?: string; confirmLabel?: string; cancelLabel?: string };

export function askConfirm(o: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (!show) return resolve(false);
    show({ kind: "confirm", confirmLabel: "OK", cancelLabel: "Cancel", ...o, resolve: (v) => resolve(v === true) });
  });
}

export function askText(o: TextOptions): Promise<string | null> {
  return new Promise((resolve) => {
    if (!show) return resolve(null);
    show({ kind: "text", confirmLabel: "Save", cancelLabel: "Cancel", ...o, resolve: (v) => resolve(typeof v === "string" ? v : null) });
  });
}

export function DialogHost() {
  const [ask, setAsk] = useState<Ask | null>(null);
  const [value, setValue] = useState("");
  const okRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    show = (a) => {
      setValue("");
      setAsk(a);
    };
    return () => {
      show = null;
    };
  }, []);

  useEffect(() => {
    if (!ask) return;
    (ask.kind === "text" ? inputRef.current : okRef.current)?.focus();
    // Capture Escape before the page's own window listeners, so only this box closes.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      e.preventDefault();
      ask.resolve(ask.kind === "text" ? null : false);
      setAsk(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [ask]);

  if (!ask) return null;
  const done = (v: boolean | string | null) => {
    ask.resolve(v);
    setAsk(null);
  };
  const cancel = () => done(ask.kind === "text" ? null : false);
  const ok = () => done(ask.kind === "text" ? value : true);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-[rgba(31,24,19,.42)] px-4 pt-[18vh]"
      onClick={cancel}
    >
      <form
        role="alertdialog"
        aria-modal="true"
        aria-label={ask.title}
        className="flex w-full max-w-[420px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(31,24,19,.35)]"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          ok();
        }}
      >
        <div className="flex flex-col gap-2 px-[22px] pb-4 pt-5">
          <b className="font-head text-lg font-semibold text-ink">{ask.title}</b>
          {ask.message && <p className="text-sm text-muted">{ask.message}</p>}
          {ask.kind === "text" && (
            <input
              ref={inputRef}
              aria-label={ask.title}
              value={value}
              placeholder={ask.placeholder}
              onChange={(e) => setValue(e.target.value)}
              className="mt-1 h-[38px] w-full rounded-lg border border-line-strong bg-white px-3 text-sm outline-none focus:border-orange"
            />
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-line bg-paper px-[22px] py-3.5">
          <button type="button" onClick={cancel} className="h-9 rounded-lg border border-line-strong bg-white px-3.5 text-sm font-semibold text-ink hover:bg-bg">
            {ask.cancelLabel}
          </button>
          <button
            ref={okRef}
            type="submit"
            className={`h-9 rounded-lg px-3.5 text-sm font-semibold text-white ${ask.danger ? "bg-[#B4321F] hover:bg-[#9A2A1A]" : "bg-orange hover:opacity-90"}`}
          >
            {ask.confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
