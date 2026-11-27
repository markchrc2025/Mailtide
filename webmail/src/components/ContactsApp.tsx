"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, avatarColors } from "@/lib/client";
import { Shell } from "./Shell";
import { AddPerson, ChevronDown, Close, Download, Mail, Menu, Pen, People, Star, Tag, Trash, Upload } from "./Icons";

type Typed = { type: string; value: string };
type Contact = {
  href: string;
  etag: string;
  uid: string;
  name: string;
  first: string;
  last: string;
  emails: Typed[];
  phones: Typed[];
  company: string;
  title: string;
  notes: string;
  categories: string[];
  favorite: boolean;
};
type Folder = "all" | "favorites" | "lists" | "deleted" | `cat:${string}`;
type Form = { first: string; last: string; email: string; email2: string; phone: string; company: string; title: string; notes: string; categories: string; favorite: boolean };

const blank: Form = { first: "", last: "", email: "", email2: "", phone: "", company: "", title: "", notes: "", categories: "", favorite: false };
const label = (c: Contact) => c.name || c.emails[0]?.value || "(no name)";
const ini = (c: Contact) =>
  (label(c).replace(/[@.].*$/, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("") || "?").toUpperCase();

function toForm(c: Contact): Form {
  return {
    first: c.first || (!c.last ? c.name : ""),
    last: c.last,
    email: c.emails[0]?.value || "",
    email2: c.emails[1]?.value || "",
    phone: c.phones[0]?.value || "",
    company: c.company,
    title: c.title,
    notes: c.notes,
    categories: c.categories.join(", "),
    favorite: c.favorite,
  };
}

function toBody(f: Form, c?: Contact) {
  return {
    href: c?.href,
    uid: c?.uid,
    first: f.first,
    last: f.last,
    emails: [
      { type: "work", value: f.email.trim() },
      { type: "home", value: f.email2.trim() },
    ].filter((e) => e.value),
    phones: f.phone.trim() ? [{ type: "cell", value: f.phone.trim() }] : [],
    company: f.company,
    title: f.title,
    notes: f.notes,
    categories: f.categories.split(",").map((s) => s.trim()).filter(Boolean),
    favorite: f.favorite,
  };
}

export default function ContactsApp({ build }: { build: string }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [folder, setFolder] = useState<Folder>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<null | { contact?: Contact; form: Form }>(null);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");
  const [deleted, setDeleted] = useState<Contact[]>([]);
  const [paneOpen, setPaneOpen] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const flash = (t: string) => {
    setToast(t);
    window.setTimeout(() => setToast(""), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await api<{ contacts: Contact[] }>("/api/contacts");
      setContacts(r.contacts);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const categories = useMemo(() => [...new Set(contacts.flatMap((c) => c.categories))].sort(), [contacts]);
  const q = query.trim().toLowerCase();
  const shown = contacts.filter((c) => {
    if (folder === "favorites" && !c.favorite) return false;
    if (folder.startsWith("cat:") && !c.categories.includes(folder.slice(4))) return false;
    if (!q) return true;
    return [c.name, c.company, ...c.emails.map((e) => e.value), ...c.phones.map((p) => p.value)].some((x) => x.toLowerCase().includes(q));
  });
  const current = contacts.find((c) => c.href === selected) || null;

  async function save() {
    if (!editing) return;
    try {
      await api("/api/contacts", { method: editing.contact ? "PUT" : "POST", body: JSON.stringify(toBody(editing.form, editing.contact)) });
      flash(editing.contact ? "Contact saved" : "Contact added");
      setEditing(null);
      await load();
    } catch (e) {
      flash((e as Error).message);
    }
  }

  async function remove(c: Contact) {
    if (!window.confirm(`Delete ${label(c)}? You can restore it from Deleted until you leave this page.`)) return;
    try {
      await api(`/api/contacts?href=${encodeURIComponent(c.href)}`, { method: "DELETE" });
      setDeleted((d) => [c, ...d]);
      setSelected(null);
      flash("Contact deleted");
      load();
    } catch (e) {
      flash((e as Error).message);
    }
  }

  async function restore(c: Contact) {
    try {
      await api("/api/contacts", { method: "POST", body: JSON.stringify(toBody(toForm(c))) });
      setDeleted((d) => d.filter((x) => x !== c));
      flash("Contact restored");
      load();
    } catch (e) {
      flash((e as Error).message);
    }
  }

  async function toggleFavorite(c: Contact) {
    try {
      await api("/api/contacts", { method: "PUT", body: JSON.stringify(toBody({ ...toForm(c), favorite: !c.favorite }, c)) });
      load();
    } catch (e) {
      flash((e as Error).message);
    }
  }

  async function addCategory(c: Contact) {
    const name = window.prompt("Category name (for example Clients or Suppliers)");
    if (!name?.trim()) return;
    try {
      const f = toForm(c);
      f.categories = [...c.categories, name.trim()].join(", ");
      await api("/api/contacts", { method: "PUT", body: JSON.stringify(toBody(f, c)) });
      load();
    } catch (e) {
      flash((e as Error).message);
    }
  }

  async function importFile(file: File) {
    try {
      const text = await file.text();
      const r = await fetch("/api/contacts/import", { method: "POST", body: text, headers: { "Content-Type": "text/vcard" } });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Import failed.");
      flash(`${j.saved} ${j.saved === 1 ? "contact" : "contacts"} imported${j.partial ? " (some were skipped)" : ""}`);
      load();
    } catch (e) {
      flash((e as Error).message);
    }
  }

  function shareVcard(c: Contact) {
    const lines = ["BEGIN:VCARD", "VERSION:3.0", `FN:${label(c)}`, `N:${c.last};${c.first};;;`, c.company ? `ORG:${c.company}` : "", c.title ? `TITLE:${c.title}` : "", ...c.emails.map((e) => `EMAIL:${e.value}`), ...c.phones.map((p) => `TEL:${p.value}`), "END:VCARD"].filter(Boolean);
    const blob = new Blob([lines.join("\r\n") + "\r\n"], { type: "text/vcard" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${label(c).replace(/[^\w.-]+/g, "_")}.vcf`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const cmd = (icon: React.ReactNode, text: string, onClick: () => void, disabled = false) => (
    <button onClick={onClick} disabled={disabled} className="flex h-[34px] flex-none items-center gap-1.5 rounded-lg px-2 text-[13.5px] hover:bg-bg disabled:opacity-40 disabled:hover:bg-transparent">
      {icon}
      {text}
    </button>
  );
  const sep = <span className="mx-1 h-[22px] w-px flex-none bg-line-strong" />;
  const nav = (key: Folder, icon: React.ReactNode, text: string, count?: number) => (
    <button
      key={key}
      onClick={() => {
        setFolder(key);
        setSelected(null);
      }}
      className={`flex h-[38px] w-full items-center gap-2.5 rounded-lg pl-7 pr-3 text-left text-sm ${folder === key ? "bg-[#FBF3EE] font-semibold shadow-[inset_3px_0_0_#E8693A]" : "hover:bg-white/70"}`}
    >
      <span className="text-ink-soft">{icon}</span>
      <span className="flex-1 truncate">{text}</span>
      {count !== undefined && <span className="text-[12.5px] text-muted">{count}</span>}
    </button>
  );

  // Letter groups for the list.
  const groups: { letter: string; items: Contact[] }[] = [];
  for (const c of shown) {
    const L = (label(c)[0] || "#").toUpperCase().replace(/[^A-Z]/, "#");
    const g = groups[groups.length - 1];
    if (g && g.letter === L) g.items.push(c);
    else groups.push({ letter: L, items: [c] });
  }

  return (
    <Shell
      active="contacts"
      build={build}
      search={{ value: query, onChange: setQuery, onSubmit: () => null, onClear: () => setQuery(""), placeholder: "Search contacts and directory" }}
    >
      <div className="mx-2.5 mt-2 flex flex-none flex-col gap-0.5 rounded-xl border border-line bg-white px-2 pb-1.5 pt-1">
        <div className="flex gap-1 text-[13.5px]">
          <span className="px-2.5 py-1.5 font-semibold shadow-[inset_0_-2px_0_#E8693A]">Home</span>
        </div>
        <div className="scroll-thin flex items-center gap-0.5 overflow-x-auto whitespace-nowrap">
          <button onClick={() => setEditing({ form: { ...blank } })} className="flex h-[34px] flex-none items-center gap-1.5 rounded-lg bg-orange px-3 text-[13.5px] font-semibold text-white hover:bg-orange-press">
            <AddPerson size={16} /> New contact
          </button>
          {sep}
          {cmd(<Pen size={17} />, "Edit", () => current && setEditing({ contact: current, form: toForm(current) }), !current)}
          {cmd(<Trash size={17} />, "Delete", () => current && remove(current), !current)}
          {sep}
          {cmd(<Mail size={17} />, "Email", () => current?.emails[0] && (window.location.href = `/mail?compose=${encodeURIComponent(current.emails[0].value)}`), !current?.emails.length)}
          {cmd(<Download size={17} />, "Share as vCard", () => current && shareVcard(current), !current)}
          {sep}
          {cmd(<Star size={17} filled={!!current?.favorite} />, current?.favorite ? "Remove from favorites" : "Add to favorites", () => current && toggleFavorite(current), !current)}
          {cmd(<Tag size={17} />, "Add category", () => current && addCategory(current), !current)}
          {sep}
          {cmd(<Upload size={17} />, "Import", () => fileRef.current?.click())}
          <a href="/api/contacts/export" className="flex h-[34px] flex-none items-center gap-1.5 rounded-lg px-2 text-[13.5px] text-ink no-underline hover:bg-bg">
            <Download size={17} /> Export
          </a>
          <input
            ref={fileRef}
            type="file"
            accept=".vcf,text/vcard,text/x-vcard"
            className="hidden"
            aria-label="Import contacts file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importFile(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      <div className="mt-2 flex min-h-0 flex-1">
        {paneOpen ? (
          <nav aria-label="Contact folders" className="scroll-thin hidden w-[260px] flex-none flex-col gap-0.5 overflow-auto px-2 py-2.5 md:flex">
            <button onClick={() => setPaneOpen(false)} aria-label="Collapse folders" className="mb-1 ml-1 flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/70">
              <Menu size={18} />
            </button>
            <div className="flex items-center gap-1.5 px-2 py-1.5 text-[13.5px] font-semibold">
              <ChevronDown size={14} /> My contacts
            </div>
            {nav("all", <People size={17} />, "Your contacts", contacts.length)}
            {nav("favorites", <Star size={17} />, "Favorites", contacts.filter((c) => c.favorite).length)}
            {nav("lists", <People size={17} />, "Your contact lists")}
            {nav("deleted", <Trash size={17} />, "Deleted", deleted.length || undefined)}
            <div className="flex items-center gap-1.5 px-2 pb-1 pt-3 text-[13.5px] font-semibold">
              <ChevronDown size={14} /> <Tag size={16} /> Categories
            </div>
            {categories.length ? (
              categories.map((c) => nav(`cat:${c}`, <Tag size={15} />, c, contacts.filter((x) => x.categories.includes(c)).length))
            ) : (
              <p className="m-0 pl-7 pr-3 text-[13px] leading-snug text-muted">When you create categories, they will appear here.</p>
            )}
          </nav>
        ) : (
          <button onClick={() => setPaneOpen(true)} aria-label="Show folders" className="ml-1 hidden h-9 w-9 flex-none items-center justify-center rounded-lg hover:bg-white/70 md:flex">
            <Menu size={18} />
          </button>
        )}

        <div className="mb-2.5 mr-2.5 flex min-w-0 flex-1 overflow-hidden rounded-xl border border-line bg-white">
          {folder === "lists" ? (
            <Empty title="No contact lists yet" text="Contact lists let you email a group in one go. They're coming in a later update." />
          ) : folder === "deleted" ? (
            <section className="flex min-w-0 flex-1 flex-col">
              <h1 className="m-0 border-b border-line px-[22px] py-3.5 font-head text-[17px] font-semibold">Deleted</h1>
              {deleted.length ? (
                deleted.map((c) => (
                  <div key={c.href} className="flex items-center gap-3 border-b border-line-faint px-[22px] py-3">
                    <span className="flex-1 truncate text-sm">{label(c)}</span>
                    <button onClick={() => restore(c)} className="h-8 rounded-lg border border-line-strong px-3 text-[13px] font-semibold hover:bg-bg">
                      Restore
                    </button>
                  </div>
                ))
              ) : (
                <Empty title="Nothing deleted" text="Contacts you delete can be restored here until you leave this page." />
              )}
            </section>
          ) : loading && !contacts.length ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted">Loading contacts...</div>
          ) : error ? (
            <div className="m-4 h-fit rounded-xl border border-orange-line bg-orange-soft p-3 text-[13px] text-orange-text">
              {error}{" "}
              <button className="ml-1 font-semibold underline" onClick={load}>
                Try again
              </button>
            </div>
          ) : !contacts.length ? (
            <section className="flex min-w-0 flex-1 flex-col">
              <h1 className="m-0 border-b border-line px-[22px] py-3.5 font-head text-[17px] font-semibold">Your contacts</h1>
              <div className="flex flex-1 flex-col items-center justify-center gap-3.5 p-6">
                <span className="flex h-24 w-24 items-center justify-center rounded-3xl bg-sand text-orange-text">
                  <People size={44} />
                </span>
                <b className="text-base font-semibold">You haven&apos;t added any contacts yet</b>
                <button onClick={() => setEditing({ form: { ...blank } })} className="flex h-[38px] items-center gap-2 rounded-[9px] border border-line-strong bg-white px-3.5 text-sm font-semibold hover:bg-bg">
                  <AddPerson size={17} /> New contact
                </button>
              </div>
            </section>
          ) : (
            <>
              <section aria-label="Contact list" className={`scroll-thin flex w-full flex-none flex-col overflow-auto md:w-[360px] md:border-r md:border-line ${current ? "hidden md:flex" : "flex"}`}>
                <div className="flex items-center px-3.5 py-3">
                  <b className="flex-1 font-head text-base font-semibold">{folder === "favorites" ? "Favorites" : folder.startsWith("cat:") ? folder.slice(4) : "Your contacts"}</b>
                  <span className="text-[12.5px] text-muted">{shown.length}</span>
                </div>
                {!shown.length && <p className="px-3.5 text-[13px] text-muted">{q ? "No contacts match your search." : "No contacts here yet."}</p>}
                {groups.map((g) => (
                  <div key={g.letter}>
                    <div className="border-t border-line-faint px-3.5 pb-1.5 pt-2.5 text-xs font-semibold text-muted">{g.letter}</div>
                    {g.items.map((c) => {
                      const [bg, fg] = avatarColors(c.emails[0]?.value || c.name);
                      return (
                        <button
                          key={c.href}
                          onClick={() => setSelected(c.href)}
                          className={`flex w-full items-center gap-3 border-t border-line-faint px-3.5 py-2.5 text-left ${selected === c.href ? "bg-[#FBF3EE] shadow-[inset_3px_0_0_#E8693A]" : "hover:bg-paper"}`}
                        >
                          <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full font-head text-[13px] font-semibold" style={{ background: bg, color: fg }}>
                            {ini(c)}
                          </span>
                          <span className="flex min-w-0 flex-col leading-snug">
                            <b className="truncate text-sm font-semibold">{label(c)}</b>
                            <span className="truncate text-[13px] text-muted">{c.emails[0]?.value || c.company}</span>
                          </span>
                          {c.favorite && <Star size={14} filled className="ml-auto flex-none text-[#C7913D]" />}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </section>
              <section aria-label="Contact details" className={`scroll-thin min-w-0 flex-1 flex-col gap-[18px] overflow-auto bg-paper px-[26px] py-[22px] ${current ? "flex" : "hidden md:flex"}`}>
                {current ? (
                  <Details c={current} onBack={() => setSelected(null)} onEdit={() => setEditing({ contact: current, form: toForm(current) })} onFavorite={() => toggleFavorite(current)} />
                ) : (
                  <div className="m-auto text-sm text-muted">Pick a contact to see the details.</div>
                )}
              </section>
            </>
          )}
        </div>
      </div>

      {editing && <Editor editing={editing} setEditing={setEditing} onSave={save} />}

      {toast && (
        <div role="status" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-ink px-4 py-2.5 text-[13.5px] font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </Shell>
  );
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
      <b className="text-base font-semibold">{title}</b>
      <span className="max-w-[380px] text-[13.5px] text-muted">{text}</span>
    </div>
  );
}

function Details({ c, onBack, onEdit, onFavorite }: { c: Contact; onBack: () => void; onEdit: () => void; onFavorite: () => void }) {
  const [bg, fg] = avatarColors(c.emails[0]?.value || c.name);
  const field = (l: string, v: React.ReactNode) => (
    <div className="flex flex-col gap-0.5 border-b border-line-faint py-2.5 last:border-b-0">
      <span className="text-[12.5px] text-muted">{l}</span>
      <span className="break-words text-[14.5px]">{v}</span>
    </div>
  );
  const act = "flex h-9 items-center gap-1.5 rounded-[9px] border border-line-strong bg-white px-3 text-[13.5px] font-semibold text-ink no-underline hover:bg-bg";
  return (
    <>
      <button onClick={onBack} className="w-fit text-sm font-semibold text-orange-text md:hidden">
        Back to contacts
      </button>
      <div className="flex flex-wrap items-center gap-4">
        <span className="flex h-[72px] w-[72px] flex-none items-center justify-center rounded-full font-head text-2xl font-semibold" style={{ background: bg, color: fg }}>
          {ini(c)}
        </span>
        <div className="min-w-[200px] flex-1">
          <h1 className="m-0 font-head text-2xl font-semibold">{label(c)}</h1>
          {(c.title || c.company) && <p className="m-0 mt-0.5 text-sm text-muted">{[c.title, c.company].filter(Boolean).join(", ")}</p>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {c.emails[0] && (
          <a href={`/mail?compose=${encodeURIComponent(c.emails[0].value)}`} className={act}>
            <Mail size={16} /> Email
          </a>
        )}
        {c.emails[0] && (
          <a href={`/calendar?new=1`} className={act}>
            Schedule meeting
          </a>
        )}
        <button onClick={onEdit} className={act}>
          <Pen size={16} /> Edit
        </button>
        <button onClick={onFavorite} className={act}>
          <Star size={16} filled={c.favorite} /> {c.favorite ? "Favorite" : "Add to favorites"}
        </button>
      </div>
      <div className="rounded-[14px] border border-line bg-white px-[18px] py-1.5">
        {c.emails.map((e, i) => field(i === 0 ? "Email" : "Other email", <a href={`/mail?compose=${encodeURIComponent(e.value)}`}>{e.value}</a>))}
        {c.phones.map((p) => field("Phone", <a href={`tel:${p.value}`}>{p.value}</a>))}
        {c.company && field("Company", c.company)}
        {c.title && field("Job title", c.title)}
        {c.categories.length > 0 && field("Categories", c.categories.join(", "))}
        {c.notes && field("Notes", <span className="whitespace-pre-line">{c.notes}</span>)}
      </div>
    </>
  );
}

function Editor({
  editing,
  setEditing,
  onSave,
}: {
  editing: { contact?: Contact; form: Form };
  setEditing: (v: null | { contact?: Contact; form: Form }) => void;
  onSave: () => void;
}) {
  const f = editing.form;
  const set = (k: keyof Form, v: string | boolean) => setEditing({ ...editing, form: { ...f, [k]: v } });
  const inp = "h-[38px] w-full rounded-lg border border-line-strong px-3 text-sm outline-none focus:border-orange";
  const lab = "flex flex-col gap-1.5 text-[13px] font-semibold";
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-[rgba(31,24,19,.42)] p-4 md:p-14" onClick={() => setEditing(null)}>
      <div role="dialog" aria-label={editing.contact ? "Edit contact" : "New contact"} className="flex w-[640px] max-w-full flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_rgba(31,24,19,.35)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-line py-3.5 pl-[22px] pr-4">
          <b className="flex-1 font-head text-lg font-semibold">{editing.contact ? "Edit contact" : "New contact"}</b>
          <button aria-label="Close" onClick={() => setEditing(null)} className="rounded-lg p-2 hover:bg-bg">
            <Close size={18} />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave();
          }}
          className="flex flex-col gap-3.5 px-[22px] py-[18px]"
        >
          <div className="grid grid-cols-2 gap-3">
            <label className={lab}>
              First name
              <input autoFocus value={f.first} onChange={(e) => set("first", e.target.value)} className={inp} />
            </label>
            <label className={lab}>
              Last name
              <input value={f.last} onChange={(e) => set("last", e.target.value)} className={inp} />
            </label>
          </div>
          <label className={lab}>
            Email
            <input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} className={inp} />
          </label>
          <label className={lab}>
            Other email
            <input type="email" value={f.email2} onChange={(e) => set("email2", e.target.value)} className={inp} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className={lab}>
              Phone
              <input type="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} className={inp} />
            </label>
            <label className={lab}>
              Company
              <input value={f.company} onChange={(e) => set("company", e.target.value)} className={inp} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className={lab}>
              Job title
              <input value={f.title} onChange={(e) => set("title", e.target.value)} className={inp} />
            </label>
            <label className={lab}>
              Categories
              <input placeholder="Clients, Suppliers" value={f.categories} onChange={(e) => set("categories", e.target.value)} className={inp} />
            </label>
          </div>
          <label className={lab}>
            Notes
            <textarea rows={3} value={f.notes} onChange={(e) => set("notes", e.target.value)} className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm outline-none focus:border-orange" />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.favorite} onChange={(e) => set("favorite", e.target.checked)} className="accent-[#E8693A]" /> Add to favorites
          </label>
          <div className="flex justify-end gap-2 border-t border-line pt-3.5">
            <button type="button" onClick={() => setEditing(null)} className="h-9 rounded-lg border border-line-strong px-3.5 text-sm font-semibold">
              Cancel
            </button>
            <button type="submit" className="h-9 rounded-lg bg-orange px-4 text-sm font-semibold text-white hover:bg-orange-press">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
