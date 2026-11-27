"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Shell } from "./Shell";
import { Search } from "./Icons";

type Me = { email: string; name?: string; admin?: boolean; org?: string };

function Node({ name, role, initials }: { name: string; role: string; initials: string }) {
  return (
    <div className="flex w-[220px] items-center gap-2.5 rounded-xl border border-line bg-white p-3 shadow-[0_1px_2px_rgba(46,36,28,.08)]">
      <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full bg-orange text-[12.5px] font-bold text-white">{initials}</span>
      <span className="flex min-w-0 flex-col leading-tight">
        <b className="truncate text-sm font-semibold">{name}</b>
        <span className="text-[12.5px] text-muted">{role}</span>
      </span>
    </div>
  );
}

function Empty() {
  return (
    <div className="flex w-[220px] items-center gap-2.5 rounded-xl border-[1.5px] border-dashed border-line-strong bg-paper p-3" aria-hidden="true">
      <span className="h-[38px] w-[38px] flex-none rounded-full bg-sand" />
      <span className="flex flex-1 flex-col gap-1.5">
        <span className="h-2 w-[70%] rounded bg-line" />
        <span className="h-2 w-[45%] rounded bg-line-faint" />
      </span>
    </div>
  );
}

export default function OrgExplorer({ build }: { build: string }) {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    api<Me>("/api/me").then(setMe).catch(() => null);
  }, []);
  const name = me?.name || me?.email.split("@")[0] || "";
  const ini = name.replace(/[._-]+/g, " ").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <Shell active="org" build={build}>
      <section className="m-2.5 flex min-h-0 flex-1 flex-col overflow-auto rounded-xl border border-line bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
          <h1 className="m-0 flex-1 font-head text-xl font-semibold">Org Explorer</h1>
          <span className="rounded-md bg-orange-soft px-2.5 py-0.5 text-[12.5px] font-semibold text-orange-text">Coming later</span>
          <label className="flex h-[34px] w-[280px] max-w-full items-center gap-2 rounded-[9px] border border-line-strong px-3 text-muted">
            <Search size={15} />
            <input aria-label="Search people" placeholder="Search people" disabled className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </label>
        </div>
        <div className="flex flex-1 flex-col items-center px-5 pb-6 pt-9">
          {me && <Node name={name} role={me.admin ? "Org Owner" : "Member"} initials={ini} />}
          <span className="h-[26px] w-[1.5px] bg-line-strong" />
          <span className="h-[1.5px] w-[min(520px,80%)] bg-line-strong" />
          <div className="flex flex-wrap justify-center gap-10">
            {[0, 1].map((i) => (
              <div key={i} className="flex flex-col items-center">
                <span className="h-[26px] w-[1.5px] bg-line-strong" />
                <Empty />
              </div>
            ))}
          </div>
          <div className="mt-9 flex max-w-[560px] flex-col gap-2 text-center">
            <b className="font-head text-lg font-semibold">See who works with whom in {me?.org || "your organization"}</b>
            <p className="m-0 text-sm leading-relaxed text-muted">
              Org Explorer will show your organization&apos;s people, their managers and teams, with a profile card for each person. It will use the members and roles from Sentire
              Cloud, so it comes after accounts and roles are in place.
            </p>
          </div>
        </div>
      </section>
    </Shell>
  );
}
