"use client";
import { useState } from "react";
import { api } from "@/lib/client";

export default function LoginForm({ expired, hint }: { expired: boolean; hint: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(expired ? "Your session ended. Please sign in again." : "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password, remember }) });
      window.location.href = "/mail";
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const input = "h-11 rounded-[10px] border border-line-strong bg-paper px-3.5 text-sm text-ink outline-none focus:border-orange focus:bg-white";
  return (
    <form
      onSubmit={submit}
      className="flex w-full max-w-[400px] flex-col gap-[18px] rounded-[18px] border border-line bg-white p-8 shadow-[0_18px_40px_-24px_rgba(42,36,32,.35)]"
    >
      <div className="flex flex-col gap-1.5">
        <h2 className="font-head m-0 text-2xl font-semibold tracking-tight">Sign in</h2>
        <span className="text-sm text-muted">Use your MailTide email address.</span>
      </div>
      {error && (
        <div role="alert" className="rounded-[10px] border border-orange-line bg-orange-soft px-3 py-2.5 text-[13px] text-orange-text">
          {error}
        </div>
      )}
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold">Email</span>
        <input
          className={input}
          type="email"
          autoComplete="username"
          required
          placeholder={hint ? `you@${hint}` : "you@company.com"}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold">Password</span>
        <input className={input} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      <label className="flex items-center gap-2.5 text-[13.5px] text-ink-soft">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-[#E8693A]" />
        Keep me signed in on this device
      </label>
      <button
        type="submit"
        disabled={busy}
        className="h-[46px] rounded-[11px] bg-orange text-[15px] font-semibold text-white transition hover:bg-orange-press disabled:opacity-60"
      >
        {busy ? "Signing in..." : "Sign in"}
      </button>
      <span className="text-center text-xs leading-normal text-muted">
        Forgot your password? Ask your MailTide admin to reset it.
      </span>
    </form>
  );
}
