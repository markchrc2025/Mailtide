// Server-side configuration, read once from the environment.
export const config = {
  imapHost: process.env.IMAP_HOST || "mx.sentire.solutions",
  imapPort: Number(process.env.IMAP_PORT || 993),
  smtpHost: process.env.SMTP_HOST || process.env.IMAP_HOST || "mx.sentire.solutions",
  smtpPort: Number(process.env.SMTP_PORT || 587),
  domainHint: process.env.MAIL_DOMAIN_HINT || "",
};

export function sessionSecret(): string {
  const s = process.env.SESSION_SECRET || "";
  if (s.length < 32) {
    if (process.env.NODE_ENV !== "production") return "dev-only-secret-dev-only-secret-dev-only!";
    throw new Error("SESSION_SECRET must be at least 32 characters");
  }
  return s;
}

/** The build shown in the app and in /api/health (raise it with each release). */
export const BUILD = "0.1.3";
