// The Sentire apps the launcher offers. Only apps that are live appear here;
// add one when it goes live. Later Sentire Cloud supplies this per organization.
export type SentireApp = { key: string; name: string; url: string; blurb: string };

export const APPS: SentireApp[] = [
  { key: "mailtide", name: "MailTide", url: "/mail", blurb: "Mail, calendar, contacts" },
  { key: "payroll", name: "Payroll", url: "https://payroll.sentire.solutions", blurb: "Payroll and HR" },
  { key: "projects", name: "Projects", url: "https://projects.apps.sentire.solutions", blurb: "Project tracking" },
  { key: "helpdesk", name: "Helpdesk", url: "https://helpdesk.apps.sentire.solutions", blurb: "Support tickets" },
  { key: "lms", name: "LMS", url: "https://lms.apps.sentire.solutions", blurb: "Learning" },
];

/** The Admin tile shows for org admins once the admin console ships. */
export const ADMIN_CONSOLE_READY = true;
