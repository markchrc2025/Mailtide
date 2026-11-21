import sanitizeHtml from "sanitize-html";

export type Role = "inbox" | "sent" | "drafts" | "trash" | "junk" | "archive" | "flagged" | "other";

const SPECIAL: Record<string, Role> = {
  "\\Sent": "sent",
  "\\Drafts": "drafts",
  "\\Trash": "trash",
  "\\Junk": "junk",
  "\\Archive": "archive",
  "\\Flagged": "flagged",
};

const BY_NAME: Record<string, Role> = {
  inbox: "inbox",
  sent: "sent",
  "sent items": "sent",
  "sent messages": "sent",
  drafts: "drafts",
  trash: "trash",
  "deleted items": "trash",
  junk: "junk",
  spam: "junk",
  archive: "archive",
};

export function folderRole(path: string, specialUse?: string): Role {
  if (path.toUpperCase() === "INBOX") return "inbox";
  if (specialUse && SPECIAL[specialUse]) return SPECIAL[specialUse];
  return BY_NAME[path.toLowerCase()] ?? "other";
}

export const ROLE_ORDER: Role[] = ["inbox", "flagged", "sent", "drafts", "archive", "junk", "trash", "other"];

export const ROLE_LABEL: Record<Role, string> = {
  inbox: "Inbox",
  flagged: "Starred",
  sent: "Sent",
  drafts: "Drafts",
  archive: "Archive",
  junk: "Spam",
  trash: "Trash",
  other: "",
};

/** Cleans an email's HTML so it is safe to show inside the app. */
export function cleanHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      "img", "h1", "h2", "span", "font", "center", "u", "s", "del", "ins", "hr", "table", "thead", "tbody", "tfoot", "tr", "td", "th", "colgroup", "col",
    ]),
    allowedAttributes: {
      "*": ["style", "align", "valign", "width", "height", "bgcolor", "color", "dir", "title"],
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "width", "height", "style"],
      td: ["colspan", "rowspan", "style", "align", "valign", "width", "bgcolor"],
      th: ["colspan", "rowspan", "style", "align", "valign", "width", "bgcolor"],
      table: ["border", "cellpadding", "cellspacing", "width", "style", "align", "bgcolor"],
      font: ["color", "face", "size"],
    },
    allowedSchemes: ["http", "https", "mailto", "cid", "data"],
    allowedSchemesByTag: { img: ["http", "https", "cid", "data"] },
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer nofollow" },
      }),
    },
  });
}

/** Turns plain text into simple, safe HTML paragraphs. */
export function textToHtml(text: string): string {
  const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const linked = esc.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer nofollow">$1</a>');
  return linked.split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("");
}

/** Removes "Re:", "Fwd:" and the like, so replies group with their thread. */
export function baseSubject(s: string): string {
  let out = (s || "").trim();
  for (;;) {
    const next = out.replace(/^(re|fw|fwd|aw|sv|antw)\s*(\[\d+\])?\s*:\s*/i, "").trim();
    if (next === out) return out;
    out = next;
  }
}

export function snippetOf(text: string, max = 140): string {
  return (text || "").replace(/\s+/g, " ").trim().slice(0, max);
}
