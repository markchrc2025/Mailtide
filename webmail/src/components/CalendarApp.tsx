"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/client";
import { Shell } from "./Shell";
import { Calendar as CalIcon, ChevronDown, ChevronRight, Close, External, Pen, Pin, Plus, Trash } from "./Icons";

type Cal = { href: string; name: string; color: string };
type Ev = {
  id: string;
  href: string;
  calendar: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location: string;
  description: string;
  url: string;
  busy: boolean;
  isPrivate: boolean;
  recurring: boolean;
  organizer: string;
  attendees: { email: string; name: string; optional: boolean; status: string }[];
};
type View = "day" | "workweek" | "week" | "month";

const DAY = 86400000;
const HOUR_PX = 48;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const monday = (d: Date) => addDays(startOfDay(d), -((d.getDay() + 6) % 7));
const sunday = (d: Date) => addDays(startOfDay(d), -d.getDay());
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const hm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const timeLabel = (d: Date) => d.toLocaleTimeString("en", { hour: "numeric", minute: "2-digit" });
const hourLabel = (h: number) => (h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`);

function rangeFor(view: View, anchor: Date): { from: Date; days: Date[] } {
  if (view === "day") return { from: startOfDay(anchor), days: [startOfDay(anchor)] };
  if (view === "workweek") {
    const m = monday(anchor);
    return { from: m, days: [0, 1, 2, 3, 4].map((i) => addDays(m, i)) };
  }
  if (view === "week") {
    const s = sunday(anchor);
    return { from: s, days: [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(s, i)) };
  }
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const s = sunday(first);
  return { from: s, days: Array.from({ length: 42 }, (_, i) => addDays(s, i)) };
}

/** Lays out the timed events of one day in side-by-side columns where they overlap. */
function layoutDay(evs: Ev[], day: Date) {
  const dayStart = day.getTime();
  const items = evs
    .map((e) => {
      const s = Math.max(new Date(e.start).getTime(), dayStart);
      const en = Math.min(new Date(e.end).getTime(), dayStart + DAY);
      return { e, s, en: Math.max(en, s + 15 * 60000) };
    })
    .sort((a, b) => a.s - b.s || b.en - a.en);
  const cols: number[] = [];
  const placed: { e: Ev; s: number; en: number; col: number; of: number }[] = [];
  let cluster: typeof placed = [];
  let clusterEnd = 0;
  const flush = () => {
    const n = Math.max(1, ...cluster.map((c) => c.col + 1));
    cluster.forEach((c) => (c.of = n));
    cluster = [];
    cols.length = 0;
  };
  for (const it of items) {
    if (cluster.length && it.s >= clusterEnd) flush();
    let col = cols.findIndex((end) => end <= it.s);
    if (col === -1) col = cols.length;
    cols[col] = it.en;
    const p = { ...it, col, of: 1 };
    placed.push(p);
    cluster.push(p);
    clusterEnd = Math.max(clusterEnd, it.en);
  }
  flush();
  return placed;
}

export default function CalendarApp({ build }: { build: string }) {
  const [view, setView] = useState<View>("workweek");
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [miniMonth, setMiniMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [calendars, setCalendars] = useState<Cal[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [events, setEvents] = useState<Ev[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<null | { start: Date; end: Date; allDay: boolean }>(null);
  const [picked, setPicked] = useState<Ev | null>(null);
  const [toast, setToast] = useState("");
  const [now, setNow] = useState(() => new Date());
  const gridRef = useRef<HTMLDivElement>(null);

  const { from, days } = useMemo(() => rangeFor(view, anchor), [view, anchor]);
  const to = useMemo(() => addDays(days[days.length - 1], 1), [days]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await api<{ calendars: Cal[]; events: Ev[] }>(`/api/calendar?start=${from.toISOString()}&end=${to.toISOString()}`);
      setCalendars(r.calendars);
      setEvents(r.events);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new") === "1") openNew();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (gridRef.current && view !== "month") gridRef.current.scrollTop = 7 * HOUR_PX;
  }, [view]);

  function flash(t: string) {
    setToast(t);
    window.setTimeout(() => setToast(""), 3500);
  }

  function openNew(at?: Date) {
    const base = at || new Date(Math.ceil(Date.now() / (30 * 60000)) * 30 * 60000);
    setDraft({ start: base, end: new Date(base.getTime() + 30 * 60000), allDay: false });
  }

  function step(dir: number) {
    if (view === "month") setAnchor((a) => new Date(a.getFullYear(), a.getMonth() + dir, 1));
    else setAnchor((a) => addDays(a, dir * (view === "day" ? 1 : 7)));
  }

  const color = (href: string) => calendars.find((c) => c.href === href)?.color || "#E8693A";
  const visible = events.filter((e) => !hidden.has(e.calendar));
  const title =
    view === "month"
      ? anchor.toLocaleString("en", { month: "long", year: "numeric" })
      : view === "day"
        ? anchor.toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
        : `${days[0].toLocaleDateString("en", { month: "long", day: "numeric" })} to ${days[days.length - 1].toLocaleDateString("en", {
            month: days[0].getMonth() === days[days.length - 1].getMonth() ? undefined : "long",
            day: "numeric",
            year: "numeric",
          })}`;

  async function remove(ev: Ev) {
    if (!window.confirm(ev.recurring ? `Delete every event in the series "${ev.title}"?` : `Delete "${ev.title}"?`)) return;
    try {
      await api(`/api/calendar/events?href=${encodeURIComponent(ev.href)}`, { method: "DELETE" });
      setPicked(null);
      flash("Event deleted");
      load();
    } catch (e) {
      flash((e as Error).message);
    }
  }

  const viewBtn = (v: View, label: string) => (
    <button
      key={v}
      onClick={() => setView(v)}
      aria-pressed={view === v}
      className={`h-[30px] rounded-[7px] px-2.5 text-[13px] ${view === v ? "bg-white font-semibold shadow-[0_1px_2px_rgba(46,36,28,.15)]" : "text-ink-soft"}`}
    >
      {label}
    </button>
  );

  return (
    <Shell active="calendar" build={build}>
      {/* Ribbon */}
      <div className="mx-2.5 mt-2 flex flex-none flex-col gap-0.5 rounded-xl border border-line bg-white px-2 pb-1.5 pt-1">
        <div className="flex gap-1 text-[13.5px]">
          <span className="px-2.5 py-1.5 font-semibold shadow-[inset_0_-2px_0_#E8693A]">Home</span>
        </div>
        <div className="scroll-thin flex items-center gap-1 overflow-x-auto whitespace-nowrap">
          <button onClick={() => openNew()} className="flex h-[34px] flex-none items-center gap-1.5 rounded-lg bg-orange px-3 text-[13.5px] font-semibold text-white hover:bg-orange-press">
            <Plus size={16} /> New event
          </button>
          <span className="mx-1 h-[22px] w-px flex-none bg-line-strong" />
          <button onClick={() => setAnchor(startOfDay(new Date()))} className="flex h-[34px] flex-none items-center gap-1.5 rounded-lg px-2 text-[13.5px] hover:bg-bg">
            <CalIcon size={17} /> Today
          </button>
          {(
            [
              ["day", "Day"],
              ["workweek", "Work week"],
              ["week", "Week"],
              ["month", "Month"],
            ] as [View, string][]
          ).map(([v, l]) => (
            <button key={v} onClick={() => setView(v)} className={`flex h-[34px] flex-none items-center rounded-lg px-2 text-[13.5px] ${view === v ? "bg-bg font-semibold" : "hover:bg-bg"}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2 flex min-h-0 flex-1">
        {/* Left pane */}
        <aside className="scroll-thin hidden w-[250px] flex-none flex-col gap-[18px] overflow-auto px-3.5 py-3.5 lg:flex">
          <MiniMonth
            month={miniMonth}
            setMonth={setMiniMonth}
            selected={days}
            today={now}
            onPick={(d) => {
              setAnchor(d);
              if (view === "month") setAnchor(new Date(d.getFullYear(), d.getMonth(), 1));
            }}
          />
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5 px-2 py-1 text-[13px] font-semibold text-ink-soft">
              <ChevronDown size={14} /> My calendars
            </div>
            {calendars.map((c) => (
              <label key={c.href} className="flex h-8 items-center gap-2.5 px-2 text-sm">
                <input
                  type="checkbox"
                  checked={!hidden.has(c.href)}
                  onChange={() =>
                    setHidden((s) => {
                      const n = new Set(s);
                      if (n.has(c.href)) n.delete(c.href);
                      else n.add(c.href);
                      return n;
                    })
                  }
                  style={{ accentColor: c.color }}
                  className="h-4 w-4"
                />
                <span className="truncate">{c.name}</span>
              </label>
            ))}
            {!calendars.length && !loading && <span className="px-2 text-[13px] text-muted">No calendars yet.</span>}
          </div>
        </aside>

        {/* Main */}
        <section aria-label="Calendar" className="flex min-w-0 flex-1 flex-col border-l border-line bg-white">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-3.5 py-2.5">
            <button onClick={() => setAnchor(startOfDay(new Date()))} className="h-8 rounded-lg border border-line-strong bg-white px-3 text-sm font-semibold">
              Today
            </button>
            <button aria-label="Previous" onClick={() => step(-1)} className="flex h-8 w-8 rotate-180 items-center justify-center rounded-lg hover:bg-bg">
              <ChevronRight size={16} />
            </button>
            <button aria-label="Next" onClick={() => step(1)} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-bg">
              <ChevronRight size={16} />
            </button>
            <h1 className="m-0 flex-1 font-head text-[19px] font-semibold">{title}</h1>
            {loading && <span className="text-[12.5px] text-muted">Loading...</span>}
            <div className="flex gap-0.5 rounded-[9px] bg-sand p-[3px]">
              {viewBtn("day", "Day")}
              {viewBtn("workweek", "Work week")}
              {viewBtn("week", "Week")}
              {viewBtn("month", "Month")}
            </div>
          </div>
          {error && (
            <div className="m-3 rounded-xl border border-orange-line bg-orange-soft p-3 text-[13px] text-orange-text">
              {error}{" "}
              <button className="ml-1 font-semibold underline" onClick={load}>
                Try again
              </button>
            </div>
          )}

          {view === "month" ? (
            <MonthGrid days={days} month={anchor.getMonth()} events={visible} color={color} today={now} onPick={setPicked} onNew={(d) => setDraft({ start: d, end: addDays(d, 1), allDay: true })} />
          ) : (
            <>
              <div className="grid border-b border-line" style={{ gridTemplateColumns: `64px repeat(${days.length}, minmax(0,1fr))` }}>
                <div />
                {days.map((d) => {
                  const isToday = sameDay(d, now);
                  const allDay = visible.filter((e) => e.allDay && new Date(e.start) < addDays(d, 1) && new Date(e.end) > d);
                  return (
                    <div key={d.toISOString()} className="flex min-w-0 flex-col gap-1 border-l border-line px-2.5 py-2">
                      <div className="flex items-baseline gap-2">
                        <b className={`font-head text-[22px] font-semibold ${isToday ? "rounded-lg bg-orange px-1.5 text-white" : ""}`}>{d.getDate()}</b>
                        <span className="text-[13px] text-muted">{d.toLocaleDateString("en", { weekday: "short" })}</span>
                      </div>
                      {allDay.map((e) => (
                        <button key={e.id} onClick={() => setPicked(e)} className="truncate rounded-md px-2 py-0.5 text-left text-xs font-semibold text-white" style={{ background: color(e.calendar) }}>
                          {e.title}
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
              <div ref={gridRef} className="scroll-thin min-h-0 flex-1 overflow-auto">
                <div className="grid pt-2" style={{ gridTemplateColumns: `64px repeat(${days.length}, minmax(0,1fr))`, height: HOUR_PX * 24 + 8 }}>
                  <div>
                    {Array.from({ length: 24 }, (_, h) => (
                      <div key={h} className="-translate-y-[7px] pr-2 text-right text-[11.5px] text-muted" style={{ height: HOUR_PX }}>
                        {h ? hourLabel(h) : ""}
                      </div>
                    ))}
                  </div>
                  {days.map((d) => {
                    const placed = layoutDay(
                      visible.filter((e) => !e.allDay && new Date(e.start) < addDays(d, 1) && new Date(e.end) > d),
                      d,
                    );
                    const isToday = sameDay(d, now);
                    return (
                      <div
                        key={d.toISOString()}
                        className="relative cursor-pointer border-l border-line"
                        style={{ backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_PX - 1}px, #F1ECE4 ${HOUR_PX - 1}px, #F1ECE4 ${HOUR_PX}px)` }}
                        onClick={(ev) => {
                          const y = ev.clientY - (ev.currentTarget as HTMLDivElement).getBoundingClientRect().top;
                          const mins = Math.max(0, Math.floor(y / (HOUR_PX / 2)) * 30);
                          openNew(new Date(d.getTime() + mins * 60000));
                        }}
                      >
                        {placed.map(({ e, s, en, col, of }) => {
                          const top = ((s - d.getTime()) / 3600000) * HOUR_PX;
                          const h = Math.max(20, ((en - s) / 3600000) * HOUR_PX - 2);
                          const c = color(e.calendar);
                          return (
                            <button
                              key={e.id}
                              onClick={(x) => {
                                x.stopPropagation();
                                setPicked(e);
                              }}
                              className="absolute overflow-hidden rounded-md border-l-[3px] px-2 py-1 text-left text-[12.5px] leading-tight"
                              style={{ top, height: h, left: `calc(${(col / of) * 100}% + 3px)`, width: `calc(${100 / of}% - 7px)`, background: `${c}22`, borderColor: c, color: "#2A2420" }}
                            >
                              <b className="block truncate font-semibold">{e.title}</b>
                              {h > 34 && (
                                <span className="block truncate text-[11.5px] text-ink-soft">
                                  {timeLabel(new Date(e.start))}
                                  {e.location ? `, ${e.location}` : ""}
                                </span>
                              )}
                            </button>
                          );
                        })}
                        {isToday && (
                          <div className="pointer-events-none absolute left-0 right-0 h-0.5 bg-orange" style={{ top: ((now.getTime() - d.getTime()) / 3600000) * HOUR_PX }}>
                            <span className="absolute -left-[5px] -top-1 h-2.5 w-2.5 rounded-full bg-orange" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {picked && <EventCard ev={picked} color={color(picked.calendar)} onClose={() => setPicked(null)} onDelete={() => remove(picked)} />}

      {draft && (
        <NewEvent
          initial={draft}
          calendars={calendars}
          events={events}
          onClose={() => setDraft(null)}
          onSaved={(invited) => {
            setDraft(null);
            flash(invited ? `Event saved. Invitation sent to ${invited} ${invited === 1 ? "person" : "people"}.` : "Event saved");
            load();
          }}
        />
      )}

      {toast && (
        <div role="status" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-ink px-4 py-2.5 text-[13.5px] font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </Shell>
  );
}

function MiniMonth({ month, setMonth, selected, today, onPick }: { month: Date; setMonth: (d: Date) => void; selected: Date[]; today: Date; onPick: (d: Date) => void }) {
  const start = sunday(month);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const sel = new Set(selected.map(ymd));
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center">
        <b className="flex-1 text-sm font-semibold">{month.toLocaleString("en", { month: "long", year: "numeric" })}</b>
        <button aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="flex h-7 w-7 rotate-180 items-center justify-center rounded hover:bg-white">
          <ChevronRight size={14} />
        </button>
        <button aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="flex h-7 w-7 items-center justify-center rounded hover:bg-white">
          <ChevronRight size={14} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={i} className="text-[11.5px] text-muted">
            {d}
          </span>
        ))}
        {cells.map((d) => {
          const isToday = sameDay(d, today);
          const inSel = sel.has(ymd(d));
          return (
            <button
              key={d.toISOString()}
              onClick={() => onPick(d)}
              className={`h-7 rounded-[7px] text-[12.5px] ${isToday ? "bg-orange font-bold text-white" : inSel ? "bg-orange-soft" : "hover:bg-white"} ${d.getMonth() !== month.getMonth() && !isToday ? "text-muted" : ""}`}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MonthGrid({ days, month, events, color, today, onPick, onNew }: { days: Date[]; month: number; events: Ev[]; color: (h: string) => string; today: Date; onPick: (e: Ev) => void; onNew: (d: Date) => void }) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-[auto_repeat(6,minmax(0,1fr))] overflow-auto">
      {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((d) => (
        <div key={d} className="border-b border-l border-line px-2 py-1.5 text-[12.5px] text-muted">
          {d}
        </div>
      ))}
      {days.map((d) => {
        const list = events.filter((e) => new Date(e.start) < addDays(d, 1) && new Date(e.end) > d);
        return (
          <div key={d.toISOString()} onClick={() => onNew(d)} className={`flex min-h-[90px] cursor-pointer flex-col gap-0.5 border-b border-l border-line p-1.5 ${d.getMonth() !== month ? "bg-paper" : ""}`}>
            <span className={`w-fit px-1 text-[12.5px] ${sameDay(d, today) ? "rounded-md bg-orange font-bold text-white" : d.getMonth() !== month ? "text-muted" : ""}`}>{d.getDate()}</span>
            {list.slice(0, 3).map((e) => (
              <button
                key={e.id}
                onClick={(x) => {
                  x.stopPropagation();
                  onPick(e);
                }}
                className="truncate rounded px-1.5 text-left text-[11.5px] font-semibold"
                style={{ background: `${color(e.calendar)}22`, color: "#2A2420" }}
              >
                {!e.allDay && <span className="font-normal text-ink-soft">{timeLabel(new Date(e.start))} </span>}
                {e.title}
              </button>
            ))}
            {list.length > 3 && <span className="px-1.5 text-[11.5px] text-muted">{list.length - 3} more</span>}
          </div>
        );
      })}
    </div>
  );
}

function EventCard({ ev, color, onClose, onDelete }: { ev: Ev; color: string; onClose: () => void; onDelete: () => void }) {
  const s = new Date(ev.start);
  const e = new Date(ev.end);
  const when = ev.allDay
    ? s.toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" })
    : `${s.toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" })}, ${timeLabel(s)} to ${timeLabel(e)}`;
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-[rgba(31,24,19,.25)] px-4 pt-24" onClick={onClose}>
      <div role="dialog" aria-label={ev.title} className="w-[440px] max-w-full rounded-2xl bg-white p-5 shadow-[0_24px_60px_rgba(31,24,19,.3)]" onClick={(x) => x.stopPropagation()}>
        <div className="flex items-start gap-3">
          <span className="mt-1.5 h-3 w-3 flex-none rounded-sm" style={{ background: color }} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 className="m-0 font-head text-lg font-semibold">{ev.title}</h2>
            <span className="text-sm text-ink-soft">
              {when}
              {ev.recurring ? " (repeats)" : ""}
            </span>
            {ev.location && <span className="text-sm">{ev.location}</span>}
          </div>
          <button aria-label="Close" onClick={onClose} className="rounded-lg p-1.5 hover:bg-bg">
            <Close size={17} />
          </button>
        </div>
        {ev.url && (
          <a href={ev.url} target="_blank" rel="noopener noreferrer" className="mt-3 flex w-fit items-center gap-1.5 rounded-lg bg-orange px-3 py-1.5 text-sm font-semibold text-white no-underline">
            Join meeting <External size={14} />
          </a>
        )}
        {ev.attendees.length > 0 && (
          <div className="mt-3 text-[13px]">
            <b className="font-semibold">Attendees</b>
            <ul className="m-0 mt-1 list-none p-0 text-ink-soft">
              {ev.attendees.map((a) => (
                <li key={a.email}>
                  {a.name || a.email}
                  {a.optional ? " (optional)" : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
        {ev.description && <p className="mb-0 mt-3 whitespace-pre-line text-[13.5px] text-ink-soft">{ev.description}</p>}
        <div className="mt-4 flex gap-2 border-t border-line pt-3">
          <button onClick={onDelete} className="flex h-9 items-center gap-1.5 rounded-lg border border-line-strong px-3 text-[13.5px] font-semibold hover:bg-bg">
            <Trash size={15} /> Delete
          </button>
        </div>
      </div>
    </div>
  );
}

const TIMES = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);
const t12 = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

function NewEvent({
  initial,
  calendars,
  events,
  onClose,
  onSaved,
}: {
  initial: { start: Date; end: Date; allDay: boolean };
  calendars: Cal[];
  events: Ev[];
  onClose: () => void;
  onSaved: (invited: number) => void;
}) {
  const [title, setTitle] = useState("");
  const [required, setRequired] = useState("");
  const [optional, setOptional] = useState("");
  const [showOptional, setShowOptional] = useState(false);
  const [date, setDate] = useState(ymd(initial.start));
  const [endDate, setEndDate] = useState(ymd(initial.allDay ? addDays(initial.end, -1) : initial.end));
  const [startT, setStartT] = useState(() => {
    const t = hm(initial.start);
    return TIMES.includes(t) ? t : "09:00";
  });
  const [endT, setEndT] = useState(() => {
    const t = hm(initial.end);
    return TIMES.includes(t) ? t : "09:30";
  });
  const [allDay, setAllDay] = useState(initial.allDay);
  const [location, setLocation] = useState("");
  const [link, setLink] = useState("");
  const [details, setDetails] = useState("");
  const [series, setSeries] = useState(false);
  const [repeat, setRepeat] = useState<"daily" | "weekly" | "monthly" | "yearly">("weekly");
  const [busy, setBusy] = useState(true);
  const [reminder, setReminder] = useState<number | null>(15);
  const [category, setCategory] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [calendar, setCalendar] = useState(calendars[0]?.href || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => titleRef.current?.focus(), []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const startDt = new Date(`${date}T${startT}:00`);
  let endDt = new Date(`${date}T${endT}:00`);
  if (!allDay && endDt <= startDt) endDt = new Date(startDt.getTime() + 30 * 60000);
  const list = (s: string) => s.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);

  async function save() {
    setError("");
    setSaving(true);
    try {
      const r = await api<{ invited: number }>("/api/calendar/events", {
        method: "POST",
        body: JSON.stringify({
          calendar: calendar || undefined,
          title: title.trim(),
          start: allDay ? date : startDt.toISOString(),
          end: allDay ? ymd(addDays(new Date(`${endDate < date ? date : endDate}T00:00:00`), 1)) : endDt.toISOString(),
          allDay,
          location: location.trim() || undefined,
          description: details.trim() || undefined,
          meetingLink: link.trim(),
          required: list(required),
          optional: list(optional),
          busy,
          isPrivate,
          reminderMinutes: reminder,
          repeat: series ? repeat : "none",
          category: category.trim() || undefined,
        }),
      });
      onSaved(r.invited || 0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // Day preview on the right: that day's events plus this one.
  const day = startOfDay(new Date(`${date}T00:00:00`));
  const dayEvents = events.filter((e) => !e.allDay && new Date(e.start) < addDays(day, 1) && new Date(e.end) > day);
  const PREV = 44;
  const firstHour = Math.max(0, Math.min(startDt.getHours() - 1, 15));
  const hours = Array.from({ length: 9 }, (_, i) => firstHour + i).filter((h) => h < 24);
  const pos = (d: Date) => ((d.getTime() - day.getTime()) / 3600000 - firstHour) * PREV;

  const field = "flex min-h-[46px] min-w-0 flex-1 items-center gap-2.5 border-b border-line-strong";
  const sel = "h-8 rounded-[7px] border border-line-strong bg-white px-1.5 text-[13.5px]";
  const tb = "flex h-[34px] flex-none items-center gap-1.5 rounded-lg px-2.5 text-[13.5px]";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-[rgba(31,24,19,.42)] p-3 md:p-8" onClick={onClose}>
      <div role="dialog" aria-label="New event" className="flex max-h-full w-[1180px] max-w-full flex-col overflow-hidden rounded-2xl bg-paper shadow-[0_24px_60px_rgba(31,24,19,.35)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1.5 py-2.5 pl-5 pr-3">
          <b className="flex-1 font-head text-base font-semibold">New event</b>
          <button aria-label="Close" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-sand">
            <Close size={18} />
          </button>
        </div>
        <div className="scroll-thin mx-4 flex items-center gap-0.5 overflow-x-auto whitespace-nowrap rounded-xl border border-line bg-white px-2 py-1.5">
          <button onClick={save} disabled={saving} className={`${tb} bg-orange font-semibold text-white hover:bg-orange-press disabled:opacity-60`}>
            {saving ? "Saving..." : "Save"}
          </button>
          <span className="mx-1 h-[22px] w-px flex-none bg-line-strong" />
          <button onClick={() => setSeries(false)} aria-pressed={!series} className={`${tb} ${!series ? "border border-line-strong bg-sand" : ""}`}>
            <CalIcon size={16} /> Event
          </button>
          <button onClick={() => setSeries(true)} aria-pressed={series} className={`${tb} ${series ? "border border-line-strong bg-sand" : ""}`}>
            Series
          </button>
          {series && (
            <select aria-label="Repeat" value={repeat} onChange={(e) => setRepeat(e.target.value as typeof repeat)} className={sel}>
              <option value="daily">Every day</option>
              <option value="weekly">Every week</option>
              <option value="monthly">Every month</option>
              <option value="yearly">Every year</option>
            </select>
          )}
          <span className="mx-1 h-[22px] w-px flex-none bg-line-strong" />
          <select aria-label="Show as" value={busy ? "busy" : "free"} onChange={(e) => setBusy(e.target.value === "busy")} className={sel}>
            <option value="busy">Busy</option>
            <option value="free">Free</option>
          </select>
          <select aria-label="Reminder" value={reminder === null ? "none" : String(reminder)} onChange={(e) => setReminder(e.target.value === "none" ? null : Number(e.target.value))} className={`${sel} ml-1`}>
            <option value="none">No reminder</option>
            <option value="0">At start time</option>
            <option value="5">5 minutes before</option>
            <option value="15">15 minutes before</option>
            <option value="30">30 minutes before</option>
            <option value="60">1 hour before</option>
            <option value="1440">1 day before</option>
          </select>
          <input aria-label="Category" placeholder="Category" value={category} onChange={(e) => setCategory(e.target.value)} className={`${sel} ml-1 w-[120px]`} />
          <label className={`${tb} cursor-pointer`}>
            <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="accent-[#E8693A]" /> Private
          </label>
          {calendars.length > 1 && (
            <select aria-label="Calendar" value={calendar} onChange={(e) => setCalendar(e.target.value)} className={`${sel} ml-1`}>
              {calendars.map((c) => (
                <option key={c.href} value={c.href}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>
        {error && <div className="mx-4 mt-2 rounded-lg bg-orange-soft px-3 py-2 text-[13px] text-orange-text">{error}</div>}
        <div className="scroll-thin flex min-h-0 flex-1 flex-wrap gap-4 overflow-auto p-4">
          <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-3.5">
            <div className="flex flex-col gap-1 rounded-xl border border-line bg-white px-[18px] pb-3.5 pt-2.5">
              <Row icon={<Pen size={19} />}>
                <div className={field}>
                  <input ref={titleRef} aria-label="Title" placeholder="Add title" value={title} onChange={(e) => setTitle(e.target.value)} className="min-w-0 flex-1 bg-transparent text-lg font-semibold outline-none" />
                </div>
              </Row>
              <Row icon={<span className="text-[13px] font-semibold">To</span>}>
                <div className={field}>
                  <input aria-label="Required attendees" placeholder="Invite required attendees" value={required} onChange={(e) => setRequired(e.target.value)} className="min-w-0 flex-1 bg-transparent text-[14.5px] outline-none" />
                  {!showOptional && (
                    <button onClick={() => setShowOptional(true)} className="text-[13.5px] font-semibold text-orange-text">
                      Optional
                    </button>
                  )}
                </div>
              </Row>
              {showOptional && (
                <Row icon={<span className="text-xs text-muted">Opt.</span>}>
                  <div className={field}>
                    <input aria-label="Optional attendees" placeholder="Invite optional attendees" value={optional} onChange={(e) => setOptional(e.target.value)} className="min-w-0 flex-1 bg-transparent text-[14.5px] outline-none" />
                  </div>
                </Row>
              )}
              <Row icon={<CalIcon size={19} />}>
                <div className={`${field} flex-wrap py-1.5`}>
                  <input type="date" aria-label="Start date" value={date} onChange={(e) => setDate(e.target.value)} className={sel} />
                  {allDay ? (
                    <>
                      <span className="text-muted">to</span>
                      <input type="date" aria-label="End date" value={endDate < date ? date : endDate} onChange={(e) => setEndDate(e.target.value)} className={sel} />
                    </>
                  ) : (
                    <>
                      <select aria-label="Start time" value={startT} onChange={(e) => setStartT(e.target.value)} className={sel}>
                        {TIMES.map((t) => (
                          <option key={t} value={t}>
                            {t12(t)}
                          </option>
                        ))}
                      </select>
                      <span className="text-muted">to</span>
                      <select aria-label="End time" value={endT} onChange={(e) => setEndT(e.target.value)} className={sel}>
                        {TIMES.map((t) => (
                          <option key={t} value={t}>
                            {t12(t)}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                  <label className="ml-auto flex items-center gap-1.5 text-[13.5px]">
                    <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="accent-[#E8693A]" /> All day
                  </label>
                </div>
              </Row>
              <Row icon={<Pin size={19} />}>
                <div className={field}>
                  <input aria-label="Location" placeholder="Add a room or location" value={location} onChange={(e) => setLocation(e.target.value)} className="min-w-0 flex-1 bg-transparent text-[14.5px] outline-none" />
                </div>
              </Row>
              <Row icon={<External size={18} />}>
                <div className={`${field} border-b-0`}>
                  <input aria-label="Meeting link" placeholder="Add a meeting link (Zoom, Meet or Teams)" value={link} onChange={(e) => setLink(e.target.value)} className="min-w-0 flex-1 bg-transparent text-[14.5px] outline-none" />
                </div>
              </Row>
            </div>
            <div className="flex min-h-[200px] flex-1 flex-col overflow-hidden rounded-xl border border-line bg-white">
              <label htmlFor="ev-details" className="sr-only">
                Event details
              </label>
              <textarea id="ev-details" placeholder="Add details for this event" value={details} onChange={(e) => setDetails(e.target.value)} className="flex-1 resize-none px-[18px] py-3.5 text-[14.5px] outline-none" />
            </div>
          </div>
          <aside aria-label="Day preview" className="flex min-w-[260px] flex-[1_1_300px] flex-col overflow-hidden rounded-xl border border-line bg-white">
            <div className="border-b border-line px-3 py-2.5 text-[14.5px] font-semibold">{day.toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</div>
            <div className="relative" style={{ height: hours.length * PREV }}>
              {hours.map((h) => (
                <div key={h} className="flex border-t border-line-faint" style={{ height: PREV }}>
                  <span className="w-[52px] flex-none pr-2 pt-0.5 text-right text-[11.5px] text-muted">{hourLabel(h)}</span>
                  <span className="flex-1 border-l border-line" />
                </div>
              ))}
              {dayEvents.map((e) => (
                <div key={e.id} className="absolute left-[58px] right-2 truncate rounded-md bg-sand px-2 text-xs" style={{ top: pos(new Date(e.start)), height: Math.max(16, pos(new Date(e.end)) - pos(new Date(e.start)) - 2) }}>
                  {e.title}
                </div>
              ))}
              {!allDay && (
                <div className="absolute left-[58px] right-2 rounded-md bg-orange px-2 py-0.5 text-xs font-semibold text-white" style={{ top: pos(startDt), height: Math.max(18, pos(endDt) - pos(startDt) - 2) }}>
                  {timeLabel(startDt)} to {timeLabel(endDt)}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3.5">
      <span className="flex w-9 flex-none justify-center text-ink-soft">{icon}</span>
      {children}
    </div>
  );
}
