# MailTide

A friendly, self-hostable console over a [Postal](https://postalserver.io) mail
server — like Plunk/Resend's dashboard, but for your own Postal. It centralizes
the values you'd otherwise hunt for in Postal's admin UI: sending domains,
per-app API credentials, and a **copy-ready env block** for each app.

MailTide **never edits DNS** (that's `add-domain`'s job) and **never touches
SMTP2GO** (Postal already relays through it). It is single-tenant today but
multi-tenant + RBAC ready in the schema and auth layer.

---

## How it talks to Postal (important)

Postal **3.3.7 has no management API.** Its entire HTTP API is four endpoints
(`send/message`, `send/raw`, `messages/message`, `messages/deliveries`), all
scoped to a single Server credential — there is no API to list domains, list or
create credentials, or read a key back. Verified against Postal's source
(`config/routes.rb`, `app/models/credential.rb`, `db/schema.rb`).

So MailTide reads Postal's **MariaDB directly, read-only**:

| Feature | Source | Notes |
|---|---|---|
| Domains | `postal.domains` (read-only) | Live status: verified, SPF, DKIM, MX, return-path |
| API Keys | `postal.credentials` (read-only) | Key is a plaintext 24-char string in Postal; MailTide reads it **live on demand and stores nothing** |
| Send Log | per-server message DBs | **Stubbed in v1** — not granted; view in Postal's UI |
| Create key | — | **Disabled by design** (read-only). Mint in Postal, reload here |

Because Postal already stores the key in plaintext and MailTide only reads it,
there is **no key material at rest in MailTide** — no encryption vault needed.

---

## Environment variables

Copy `.env.example` to `.env` and fill in. `.env` is gitignored — never commit it.

| Var | What it is |
|---|---|
| `DATABASE_URL` | MailTide's own PostgreSQL (auth + metadata only) |
| `POSTAL_DB_URL` | **Read-only** MariaDB DSN to Postal's main DB — the one Postal secret |
| `POSTAL_API_BASE_URL` | Postal's public base URL, e.g. `https://postal.sentire.solutions`. Used only to build the env block |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Seeds the single OWNER on first boot |
| `SESSION_SECRET` | Signs the httpOnly session cookie. `openssl rand -hex 32`. Rotating logs everyone out |
| `ORG_NAME` | Seed org name (optional, defaults to `MailTide`) |

There is intentionally **no** `MAILTIDE_ENCRYPTION_KEY` and **no**
`POSTAL_ADMIN_API_KEY`.

---

## Postal read-only DB user (run on the Postal box)

First confirm your Postal main DB name:

```bash
grep main_db /opt/postal/config/postal.yml
```

Then, as MariaDB root, create a dedicated read-only, **table-scoped** user
(swap `postal` if your DB name differs, and set a strong password):

```sql
CREATE USER IF NOT EXISTS 'mailtide_ro'@'127.0.0.1'
  IDENTIFIED BY 'CHANGE_ME_to_a_strong_password';

GRANT SELECT ON `postal`.`domains`     TO 'mailtide_ro'@'127.0.0.1';
GRANT SELECT ON `postal`.`credentials` TO 'mailtide_ro'@'127.0.0.1';

FLUSH PRIVILEGES;
```

This grants **SELECT only** on exactly the two tables v1 reads. It cannot read
`servers`, `organizations`, `users`, any `postal-server-*` message database, or
write anything. Verify:

```sql
SHOW GRANTS FOR 'mailtide_ro'@'127.0.0.1';
SELECT COUNT(*) FROM postal.credentials;   -- should work
-- SELECT COUNT(*) FROM `postal-server-1`.messages;  -- should be DENIED
```

Put the resulting DSN in `.env`:

```
POSTAL_DB_URL=mysql://mailtide_ro:CHANGE_ME_to_a_strong_password@127.0.0.1:3306/postal
```

> Trade-off of the minimal 2-table grant: MailTide labels credentials by domain
> and numeric `server_id` rather than Postal's server/org display names. To get
> those names, additionally `GRANT SELECT ON postal.servers` (and
> `postal.organizations`).

---

## Local development

Requires Node 22+, a PostgreSQL, and (for live Postal data) network reach to
Postal's MariaDB.

```bash
npm install
cp .env.example .env        # then edit values
npx prisma migrate deploy   # apply migrations
npm run seed                # create org + owner from env
npm run dev                 # http://localhost:3000
```

Without a reachable Postal DB, the app still runs — Domains and API Keys show a
clear "can't reach Postal" state rather than crashing.

---

## Deploy on the VPS (Docker + Caddy)

MailTide runs on the VPS in `/opt/mailtide` with **host networking**, so it can
reach Postal's MariaDB and your Postgres on `127.0.0.1`, and Caddy can proxy to
it. The app binds loopback only.

```bash
# on the VPS
cd /opt/mailtide            # your clone of this repo
cp .env.example .env        # fill in real values (incl. POSTAL_DB_URL, SESSION_SECRET)
docker compose up -d --build
docker compose logs -f      # watch migrate + seed + start
```

The container entrypoint runs `prisma migrate deploy` and the idempotent seed on
every boot, then starts Next.js on `127.0.0.1:3000`.

### Caddy

Add this to your Caddyfile:

```
console.sentire.solutions {
    reverse_proxy 127.0.0.1:3000
}
```

Then `caddy reload` (or restart the Caddy service). Caddy handles TLS
automatically.

---

## Security model

- One server-side Postal secret: `POSTAL_DB_URL` (read-only), never sent to the
  browser. All Postal access is server-side in `src/lib/postal.ts`.
- Auth: single admin password → httpOnly, `SameSite=Lax`, `Secure` session
  cookie. The DB stores only a peppered hash of the session token.
- No plaintext key material at rest in MailTide (keys are read live from Postal).
- RBAC (`OWNER/ADMIN/MEMBER/VIEWER`) wraps every mutating action from day one,
  even though only the seeded OWNER exists today.

## Tech

Next.js (App Router) · TypeScript · Tailwind + shadcn-style UI · Prisma +
PostgreSQL · `mysql2` (read-only Postal) · Docker.
