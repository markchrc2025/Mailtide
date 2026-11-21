# MailTide web mail (Phase 1: mail core)

The MailTide web app: Sentire's own mail interface over **mailcow**. Mail stays in
mailcow; this app is the screen people use, in the Sentire design (espresso
sidebar, orange actions, Instrument Sans and Hanken Grotesk).

The older Postal dashboard in the repo root is a separate tool and is untouched.

## What Phase 1 does

- Sign in with a mailcow mailbox address and password (checked by signing in to IMAP).
- Folders with unread counts (Inbox, Sent, Drafts, Archive, Spam, Trash, own folders).
- Message list with sender, subject, preview, attachment and star marks; All and Unread views; paging.
- Search across subject, sender, recipients and body.
- Read an email (cleaned HTML in a sandboxed frame), inline images, attachment downloads.
- Reply, reply all, forward (with the original attachments), quick reply, new email with Cc, Bcc and attachments up to 20 MB.
- Save drafts and reopen them from Drafts.
- Archive, delete (Trash, then delete for good from Trash), spam and not spam, move to folder, star, mark unread, bulk actions.
- New mail check every 30 seconds; unread count in the tab title.
- Keyboard: `c` new email, `/` or Ctrl/Cmd+K search, `e` archive, `#` delete, `j`/`k` next and previous, Esc close.
- Works on phones: one pane at a time, folders in a drawer, full-screen composer.

AI features (summaries, Today's brief, Draft with AI, Ask MailTide) come in Phases 3 and 4. See the
plan on the Whiteboard and the mockups canvas.

## How it works

| Part | Detail |
|---|---|
| Web + API | Next.js 15 (App Router), one container |
| Mail read | IMAP over TLS (imapflow) to `IMAP_HOST:993`, one pooled connection per mailbox |
| Mail send | SMTP submission (nodemailer) to `SMTP_HOST:587` with STARTTLS, as the signed-in user; a copy is saved to Sent |
| Session | Sealed, encrypted cookie (iron-session). The browser never sees the password |
| Safety | HTML is sanitised, shown in a sandboxed iframe without scripts; attachments download with a strict CSP; 8 failed sign-ins per 10 minutes per address are blocked |

## Environment

| Name | Example | Notes |
|---|---|---|
| `IMAP_HOST` | `mx.sentire.solutions` | mailcow host |
| `IMAP_PORT` | `993` | |
| `SMTP_HOST` | `mx.sentire.solutions` | |
| `SMTP_PORT` | `587` | `465` also works |
| `SESSION_SECRET` | (random, 32+ chars) | Create in Dokploy with generate_secret |
| `MAIL_DOMAIN_HINT` | `mailtide.sentire.solutions` | Placeholder on the sign-in page |

## Run

```bash
npm ci
npm test         # unit tests
npm run build
npm start        # or: docker build -t mailtide-webmail .
```

Health: `GET /api/health` answers `{"ok":true,"imap":true}` when the app can reach mailcow.
