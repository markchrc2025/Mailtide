import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { config } from "@/lib/config";
import LoginForm from "@/components/LoginForm";
import { Brand } from "@/components/Logo";

export const dynamic = "force-dynamic";

const FEATURES = [
  ["Clean inbox", "Important mail first, the rest later"],
  ["Fast search", "Find any email in seconds"],
  ["Hosted locally", "Your data on Sentire servers"],
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  if (await requireUser()) redirect("/mail");
  const { expired } = await searchParams;
  return (
    <div className="flex min-h-screen flex-wrap">
      <section
        className="hidden min-w-0 flex-[1_1_520px] flex-col gap-7 px-16 py-14 text-espresso-text md:flex"
        style={{ background: "linear-gradient(160deg,#2E241C,#1A140F)" }}
      >
        <Brand big tagline="Sentire's native mail" />
        <div className="flex-1" />
        <h1 className="font-head m-0 max-w-[520px] text-[44px] font-semibold leading-[1.12] tracking-[-0.02em] text-white">
          Your business email, sorted before you open it.
        </h1>
        <p className="m-0 max-w-[480px] text-base leading-relaxed text-[#D6CCBF]">
          Mail, calendar and contacts on Sentire&apos;s own servers. AI summaries and replies in your voice are on the way.
        </p>
        <div className="grid max-w-[560px] grid-cols-3 gap-3">
          {FEATURES.map(([t, d]) => (
            <div key={t} className="flex flex-col gap-1 rounded-xl border border-white/10 bg-white/[.06] p-3.5">
              <b className="font-head text-sm text-white">{t}</b>
              <span className="text-[12.5px] leading-snug text-espresso-dim">{d}</span>
            </div>
          ))}
        </div>
        <div className="flex-1" />
        <span className="text-xs text-[#A89C8D]">A Sentire Solutions product · Built on open-source mailcow</span>
      </section>
      <section className="flex min-w-0 flex-[1_1_440px] flex-col items-center justify-center gap-6 px-6 py-12">
        <div className="espresso rounded-2xl p-3 md:hidden">
          <Brand tagline="Sentire's native mail" />
        </div>
        <LoginForm expired={expired === "1"} hint={config.domainHint} />
      </section>
    </div>
  );
}
