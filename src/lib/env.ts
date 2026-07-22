/**
 * Centralised, validated access to environment variables. Server-only.
 *
 * We validate lazily (not at module import) so that `next build` — which does
 * not have real secrets — never crashes. Each accessor throws a clear error
 * only when the value is actually needed at request time.
 */
import "server-only";

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

export const env = {
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  get postalDbUrl() {
    return required("POSTAL_DB_URL");
  },
  get postalApiBaseUrl() {
    // Normalise: strip any trailing slash.
    return (process.env.POSTAL_API_BASE_URL || "https://postal.sentire.solutions").replace(/\/+$/, "");
  },
  get sessionSecret() {
    return required("SESSION_SECRET");
  },
  get adminEmail() {
    return required("ADMIN_EMAIL");
  },
  get adminPassword() {
    return required("ADMIN_PASSWORD");
  },
  get orgName() {
    return process.env.ORG_NAME?.trim() || "MailTide";
  },
};

/** The full send endpoint operators paste into their apps. */
export function postalSendMessageUrl(): string {
  return `${env.postalApiBaseUrl}/api/v1/send/message`;
}
