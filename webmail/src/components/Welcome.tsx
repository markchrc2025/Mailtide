"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";

type Info = { org: string; email: string; mailbox: string | null; role: string; invitedBy: string };

/** Public page an invitation link opens: shows the invitation and lets the person choose their password. */
export default function Welcome() {
  const [token, setToken] = useState("");
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("t") || "";
    setToken(t);
    api<Info>(`/api/welcome?t=${encodeURIComponent(t)}`).then(setInfo, (e) => setError((e as Error).message));
  }, []);
  async function accept() {
    if (info?.mailbox && pw.length < 10) return setError("Choose a password of at least 10 characters.");
    if (info?.mailbox && pw !== pw2) return setError("The two passwords don't match.");
    setBusy(true);
    setError("");
    try {
      await api("/api/welcome", { method: "POST", body: JSON.stringify({ t: token, password: pw }) });
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const inp = "h-11 w-full rounded-lg border border-line-strong bg-white px-3 text-[15px] outline-none focus:border-orange";
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-bg p-4">
      <div className="flex w-full max-w-[440px] flex-col gap-4 rounded-2xl border border-line bg-white p-7 shadow-sm">
        <h1 className="m-0 font-head text-2xl font-semibold">Welcome to MailTide</h1>
        {!info && !error && <p className="m-0 text-sm text-muted">Checking your invitation...</p>}
        {error && <div className="rounded-lg bg-orange-soft px-3 py-2 text-[13.5px] text-orange-text">{error}</div>}
        {info && !done && (
          <>
            <p className="m-0 text-[14.5px]">
              <b>{info.invitedBy}</b> invited you to <b>{info.org}</b> as {info.role}.
            </p>
            {info.mailbox ? (
              <>
                <p className="m-0 text-sm text-muted">
                  Your mailbox is <b className="text-ink">{info.mailbox}</b>. Choose its password.
                </p>
                <label className="flex flex-col gap-1.5 text-[13.5px] font-semibold">
                  Password
                  <input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} className={inp} />
                </label>
                <label className="flex flex-col gap-1.5 text-[13.5px] font-semibold">
                  Type it again
                  <input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} className={inp} />
                </label>
                <button onClick={accept} disabled={busy} className="h-11 rounded-lg bg-orange text-[15px] font-semibold text-white hover:bg-orange-press disabled:opacity-50">
                  {busy ? "Setting up..." : "Accept and set password"}
                </button>
              </>
            ) : (
              <>
                <p className="m-0 text-sm text-muted">Keep using your current mailbox ({info.email}); this adds your role.</p>
                <button onClick={accept} disabled={busy} className="h-11 rounded-lg bg-orange text-[15px] font-semibold text-white hover:bg-orange-press disabled:opacity-50">
                  {busy ? "Accepting..." : "Accept invitation"}
                </button>
              </>
            )}
          </>
        )}
        {done && (
          <>
            <p className="m-0 text-[14.5px]">You&apos;re all set. Sign in with {info?.mailbox || info?.email} and {info?.mailbox ? "your new password" : "your usual password"}.</p>
            <a href="/login" className="flex h-11 items-center justify-center rounded-lg bg-orange text-[15px] font-semibold text-white no-underline">
              Go to sign in
            </a>
          </>
        )}
      </div>
    </main>
  );
}
