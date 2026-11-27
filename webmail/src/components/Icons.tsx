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

// Added for the Outlook-style frame (0.4.0).
const mk = (d: string, extra?: { sw?: number }) =>
  function Icon({ size, className }: P) {
    return <svg {...base(size)} strokeWidth={extra?.sw ?? 2} className={className} dangerouslySetInnerHTML={{ __html: d }} />;
  };
export const Waffle = mk('<path d="M5 5h.01M12 5h.01M19 5h.01M5 12h.01M12 12h.01M19 12h.01M5 19h.01M12 19h.01M19 19h.01"/>', { sw: 3.2 });
export const Bell = mk('<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>');
export const Gear = mk('<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>');
export const Help = mk('<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.7M12 17h.01"/>');
export const Calendar = mk('<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>');
export const Contacts = mk('<circle cx="12" cy="9" r="3.5"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/>');
export const OrgChart = mk('<rect x="9" y="3" width="6" height="5" rx="1.2"/><rect x="3" y="16" width="6" height="5" rx="1.2"/><rect x="15" y="16" width="6" height="5" rx="1.2"/><path d="M12 8v4M6 16v-4h12v4"/>');
export const ChevronRight = mk('<path d="M9 6l6 6-6 6"/>');
export const ChevronDown = mk('<path d="M6 9l6 6 6-6"/>');
export const EnvelopeOpen = mk('<path d="M3 10l9-6 9 6v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M3.5 10.5L12 16l8.5-5.5"/>');
export const Pen = mk('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>');
export const External = mk('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>');
export const AddPerson = mk('<circle cx="10" cy="8.5" r="3.5"/><path d="M3.5 20a6.5 6.5 0 0 1 11-4.7M18 14v6M15 17h6"/>');
export const More = mk('<path d="M5 12h.01M12 12h.01M19 12h.01"/>', { sw: 3 });
export const Shield = mk('<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>');
export const Pin = mk('<path d="M12 21s7-6.2 7-11.5a7 7 0 0 0-14 0C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>');
export const Upload = mk('<path d="M12 20V9M7 14l5-5 5 5M4 4h16"/>');
export const Download = mk('<path d="M12 4v11M7 10l5 5 5-5M4 20h16"/>');
export const Tag = mk('<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/>');
export const People = mk('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>');
