// MailTide's own small database (shared Postgres on the app server): audit log,
// invitations, shared mailboxes and live reply status. Mail itself stays in mailcow.
import { Pool } from "pg";

const g = globalThis as unknown as { __mtDb?: Pool; __mtDbReady?: Promise<void> };

export function hasDb() {
  return !!process.env.DATABASE_URL;
}

function pool(): Pool {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  return (g.__mtDb ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }));
}

const SCHEMA = `
create table if not exists audit (
  id bigserial primary key,
  at timestamptz not null default now(),
  org text not null,
  actor text not null,
  area text not null,
  action text not null,
  detail jsonb not null default '{}'
);
create index if not exists audit_org_at on audit (org, at desc);
create table if not exists invites (
  token text primary key,
  org text not null,
  email text not null,
  mailbox text,
  role text not null,
  invited_by text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz
);
create table if not exists roles (
  org text not null,
  member text not null,
  role text not null,
  primary key (org, member)
);
create table if not exists shared_mailboxes (
  address text primary key,
  org text not null,
  name text not null,
  secret text not null,
  options jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create table if not exists shared_members (
  address text not null references shared_mailboxes(address) on delete cascade,
  member text not null,
  access text not null,
  primary key (address, member)
);
create table if not exists presence (
  mailbox text not null,
  thread text not null,
  member text not null,
  name text not null default '',
  started_at timestamptz not null default now(),
  beat_at timestamptz not null default now(),
  primary key (mailbox, thread, member)
);
create table if not exists replies (
  mailbox text not null,
  thread text not null,
  member text not null,
  name text not null default '',
  at timestamptz not null default now(),
  primary key (mailbox, thread)
);
`;

export async function db() {
  const p = pool();
  g.__mtDbReady ??= p.query(SCHEMA).then(() => undefined);
  await g.__mtDbReady;
  return p;
}

export async function q<T = Record<string, unknown>>(sql: string, args: unknown[] = []): Promise<T[]> {
  const p = await db();
  const r = await p.query(sql, args);
  return r.rows as T[];
}
