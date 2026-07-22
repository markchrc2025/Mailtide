/**
 * Read-only access to Postal's MariaDB. Server-only.
 *
 * Postal 3.3.7 has NO management API — the only HTTP endpoints are send/message
 * lookup, all scoped to a single Server credential. So to give operators a live
 * view of domains and credentials, MailTide reads Postal's database directly.
 *
 * SCOPE (must match the granted privileges):
 *   SELECT on `postal`.`domains` and `postal`.`credentials` — nothing else.
 *   We deliberately never touch `servers`, `organizations`, or any
 *   `postal-server-*` message database. The read-only DB user cannot either.
 *
 * KEY HANDLING: Postal stores each credential's `key` as a plaintext 24-char
 * string (SecureRandom.alphanumeric, immutable after creation). MailTide reads
 * it live on demand and NEVER persists it. Zero key material at rest here.
 *
 * Every function returns a PostalResult so callers can render a graceful
 * empty/error state instead of crashing when Postal's DB is unreachable.
 */
import "server-only";
import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";
import { env } from "./env";

export type PostalResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export interface PostalDomain {
  id: number;
  uuid: string | null;
  name: string;
  serverId: number | null;
  verified: boolean;
  verifiedAt: Date | null;
  spfStatus: string | null;
  dkimStatus: string | null;
  mxStatus: string | null;
  returnPathStatus: string | null;
  outgoing: boolean;
  incoming: boolean;
}

export interface PostalCredential {
  id: number;
  uuid: string | null;
  name: string | null;
  type: string | null;
  serverId: number | null;
  createdAt: Date | null;
  lastUsedAt: Date | null;
  /** Last 4 chars only — safe to render in a list. Full value is fetched on demand. */
  keyHint: string;
  keyLength: number;
  /** Verified sending domains on the same server (for the MAIL_FROM picker). */
  domains: string[];
}

/** Full credential incl. the live plaintext key. Only used for reveal-on-demand. */
export interface PostalCredentialWithKey extends PostalCredential {
  key: string;
}

let pool: Pool | null = null;

function getPool(): Pool {
  if (pool) return pool;
  const url = new URL(env.postalDbUrl);
  pool = mysql.createPool({
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    connectionLimit: 5,
    connectTimeout: 5000,
    // Read-only: we never issue writes. Belt-and-suspenders against injection —
    // all our queries are parameterised and SELECT-only anyway.
    multipleStatements: false,
    waitForConnections: true,
  });
  return pool;
}

function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/ECONNREFUSED|ETIMEDOUT|ENOTFOUND|connect ETIMEDOUT/i.test(msg)) {
    return "Can't reach Postal's database. Check POSTAL_DB_URL and that MariaDB is running.";
  }
  if (/Access denied/i.test(msg)) {
    return "Postal DB access denied. Check the read-only user's credentials and GRANTs.";
  }
  if (/Unknown database/i.test(msg)) {
    return "Postal database name not found. Check the DB name in POSTAL_DB_URL.";
  }
  if (/command denied|SELECT command denied/i.test(msg)) {
    return "The read-only user lacks SELECT on a required table (domains / credentials).";
  }
  return `Postal DB error: ${msg}`;
}

function toBool(v: unknown): boolean {
  return v === 1 || v === true || v === "1";
}

function maskKey(key: string | null): { hint: string; length: number } {
  if (!key) return { hint: "", length: 0 };
  const last4 = key.slice(-4);
  return { hint: last4, length: key.length };
}

/** All domains known to Postal, newest-verified surfaced by the UI. */
export async function listDomains(): Promise<PostalResult<PostalDomain[]>> {
  try {
    const [rows] = await getPool().query<RowDataPacket[]>(
      `SELECT id, uuid, name, server_id, verified_at,
              spf_status, dkim_status, mx_status, return_path_status,
              outgoing, incoming
         FROM domains
        ORDER BY name ASC`
    );
    const data: PostalDomain[] = rows.map((r) => ({
      id: Number(r.id),
      uuid: r.uuid ?? null,
      name: String(r.name),
      serverId: r.server_id != null ? Number(r.server_id) : null,
      verified: r.verified_at != null,
      verifiedAt: r.verified_at ? new Date(r.verified_at) : null,
      spfStatus: r.spf_status ?? null,
      dkimStatus: r.dkim_status ?? null,
      mxStatus: r.mx_status ?? null,
      returnPathStatus: r.return_path_status ?? null,
      outgoing: toBool(r.outgoing),
      incoming: toBool(r.incoming),
    }));
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

/** Verified sending domain names, grouped by Postal server id. */
async function verifiedDomainsByServer(): Promise<Map<number, string[]>> {
  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT name, server_id
       FROM domains
      WHERE verified_at IS NOT NULL AND outgoing = 1
      ORDER BY name ASC`
  );
  const map = new Map<number, string[]>();
  for (const r of rows) {
    if (r.server_id == null) continue;
    const sid = Number(r.server_id);
    const arr = map.get(sid) ?? [];
    arr.push(String(r.name));
    map.set(sid, arr);
  }
  return map;
}

/** List API-type credentials with masked hints (no full key values). */
export async function listApiCredentials(): Promise<PostalResult<PostalCredential[]>> {
  try {
    const [domainMap, [rows]] = await Promise.all([
      verifiedDomainsByServer(),
      getPool().query<RowDataPacket[]>(
        `SELECT id, uuid, name, type, server_id, ${"`key`"}, created_at, last_used_at
           FROM credentials
          WHERE type = 'API'
          ORDER BY created_at DESC`
      ),
    ]);
    const data: PostalCredential[] = rows.map((r) => {
      const { hint, length } = maskKey(r.key ?? null);
      const serverId = r.server_id != null ? Number(r.server_id) : null;
      return {
        id: Number(r.id),
        uuid: r.uuid ?? null,
        name: r.name ?? null,
        type: r.type ?? null,
        serverId,
        createdAt: r.created_at ? new Date(r.created_at) : null,
        lastUsedAt: r.last_used_at ? new Date(r.last_used_at) : null,
        keyHint: hint,
        keyLength: length,
        domains: serverId != null ? domainMap.get(serverId) ?? [] : [],
      };
    });
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

/** Fetch ONE credential incl. its live plaintext key (reveal-on-demand). */
export async function getApiCredentialWithKey(
  uuid: string
): Promise<PostalResult<PostalCredentialWithKey | null>> {
  try {
    const [domainMap, [rows]] = await Promise.all([
      verifiedDomainsByServer(),
      getPool().query<RowDataPacket[]>(
        `SELECT id, uuid, name, type, server_id, ${"`key`"}, created_at, last_used_at
           FROM credentials
          WHERE uuid = ? AND type = 'API'
          LIMIT 1`,
        [uuid]
      ),
    ]);
    if (rows.length === 0) return { ok: true, data: null };
    const r = rows[0];
    const key = String(r.key ?? "");
    const { hint, length } = maskKey(key);
    const serverId = r.server_id != null ? Number(r.server_id) : null;
    return {
      ok: true,
      data: {
        id: Number(r.id),
        uuid: r.uuid ?? null,
        name: r.name ?? null,
        type: r.type ?? null,
        serverId,
        createdAt: r.created_at ? new Date(r.created_at) : null,
        lastUsedAt: r.last_used_at ? new Date(r.last_used_at) : null,
        keyHint: hint,
        keyLength: length,
        domains: serverId != null ? domainMap.get(serverId) ?? [] : [],
        key,
      },
    };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}
