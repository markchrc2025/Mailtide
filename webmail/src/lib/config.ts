// Server-side configuration, read once from the environment.
export const config = {
  imapHost: process.env.IMAP_HOST || "mx.sentire.solutions",
  imapPort: Number(process.env.IMAP_PORT || 993),
  smtpHost: process.env.SMTP_HOST || process.env.IMAP_HOST || "mx.sentire.solutions",
  smtpPort: Number(process.env.SMTP_PORT || 587),
  domainHint: process.env.MAIL_DOMAIN_HINT || "",
  // Until accounts and roles live in Sentire Cloud (P3A), these addresses are the org admins.
  adminEmails: (process.env.ADMIN_EMAILS || "crcanlubo@sentire.solutions")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
  // Organization names by mail domain, shown in the account menu (Sentire Cloud supplies this later).
  orgNames: { "sentire.solutions": "Sentire Solutions", "mcrctas.com": "MCRC Tax and Accounting Services" } as Record<string, string>,
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
export const BUILD = "0.5.0";

export function isAdmin(email: string): boolean {
  return config.adminEmails.includes(email.toLowerCase());
}
