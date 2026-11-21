// Small line icons drawn for MailTide (24x24, stroke currentColor).
type P = { size?: number; className?: string };
const base = (size = 18) => ({
  viewBox: "0 0 24 24",
  width: size,
  height: size,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const Plus = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M12 5v14M5 12h14" /></svg>
);
export const Search = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></svg>
);
export const Inbox = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M4 13l2.5-7h11L20 13v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" /><path d="M4 13h4.5l1.5 2.5h4l1.5-2.5H20" /></svg>
);
export const Star = ({ size, className, filled }: P & { filled?: boolean }) => (
  <svg {...base(size)} className={className} fill={filled ? "currentColor" : "none"}><path d="M12 4l2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z" /></svg>
);
export const Send = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M4 12l16-8-6 16-2.5-6.5z" /><path d="M11.5 13.5L20 4" /></svg>
);
export const Draft = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M5 19h4L19 9l-4-4L5 15z" /><path d="M13 7l4 4" /></svg>
);
export const Archive = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><rect x="3.5" y="4.5" width="17" height="4" rx="1" /><path d="M5 8.5V18a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8.5M10 12h4" /></svg>
);
export const Trash = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" /></svg>
);
export const Spam = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M12 3l8 4v5c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V7z" /><path d="M12 8v5M12 16v.5" /></svg>
);
export const Folder = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M3.5 7a1 1 0 0 1 1-1H10l2 2h7.5a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z" /></svg>
);
export const Reply = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M10 8L5 12.5 10 17" /><path d="M5.5 12.5H14a5 5 0 0 1 5 5V19" /></svg>
);
export const ReplyAll = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M8 8L3 12.5 8 17" /><path d="M12 8l-5 4.5 5 4.5" /><path d="M7.5 12.5H15a5 5 0 0 1 5 5V19" /></svg>
);
export const Forward = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M14 8l5 4.5-5 4.5" /><path d="M18.5 12.5H10a5 5 0 0 0-5 5V19" /></svg>
);
export const Mail = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><rect x="3.5" y="5.5" width="17" height="13" rx="1.5" /><path d="M4 7l8 6 8-6" /></svg>
);
export const Clip = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M20 11.5l-7.8 7.8a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8" /></svg>
);
export const Back = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M15 5l-7 7 7 7" /></svg>
);
export const Menu = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M4 7h16M4 12h16M4 17h16" /></svg>
);
export const Close = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const Refresh = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M19 12a7 7 0 1 1-2.1-5" /><path d="M19 4v4h-4" /></svg>
);
export const Logout = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M14 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4" /><path d="M10 16l-4-4 4-4M6 12h9" /></svg>
);
export const Dot = ({ className }: { className?: string }) => <span className={`inline-block h-2 w-2 rounded-full ${className ?? ""}`} />;

export function RoleIcon({ role, size = 17 }: { role: string; size?: number }) {
  switch (role) {
    case "inbox":
      return <Inbox size={size} />;
    case "flagged":
      return <Star size={size} />;
    case "sent":
      return <Send size={size} />;
    case "drafts":
      return <Draft size={size} />;
    case "archive":
      return <Archive size={size} />;
    case "junk":
      return <Spam size={size} />;
    case "trash":
      return <Trash size={size} />;
    default:
      return <Folder size={size} />;
  }
}
