# UAT results: MailTide web app, Outlook frame, calendar, contacts, admin, shared mailboxes (28 Nov 2026)

- UAT task: MTD-81. Workbook: `docs/uat/webmail-outlook-admin/UAT_MTD_webmail-outlook-admin_0.5.0.xlsx`
- Marked copy: `docs/uat/webmail-outlook-admin/results/UAT_MTD_webmail-outlook-admin_0.5.1_Results_2026-11-28.xlsx`
- Environment: production, https://mailtide.apps.sentire.solutions. Build 0.5.0; three fixes retested on 0.5.1 (commit cea62b6).
- Tester: Claude, signed in as test@mailtide.sentire.solutions (Member). Owner-only cases were left for the owner.

## Totals

22 cases: 8 Passed, 0 Failed, 0 Blocked, 14 Not Tested (need the owner).

## Passed

MTD-OA-001 frame, 004 date groups and conversations, 005 ribbon actions, 006 View tab toggles, 007 calendar views, 010 contacts create/edit/favorite/category, 012 Org Explorer placeholder, 013 admin console closed to members.

## Failed on 0.5.0, fixed and passed on 0.5.1

| Case | What failed | Issue |
|---|---|---|
| MTD-OA-010 | Add to favorites answered "That contact is not yours." The same check guarded contact edit and delete and event delete. | MTD-98 |
| MTD-OA-005 | Mark read cleared the ticked rows, so Archive could not follow. | MTD-99 |
| MTD-OA-006 | The "show emails one by one" choice looked forgotten after returning to Mail (an older list answer replaced the newer one). | MTD-100 |

## Not tested: needs the owner signed in as CRCanlubo@sentire.solutions

| Case | What to check |
|---|---|
| MTD-OA-002 | Admin tile appears for the Owner (the Member half passed: five apps, no Admin tile) |
| MTD-OA-003 | "Sign in with a different account" signs out and opens the login page (menu contents were seen) |
| MTD-OA-008 | Create an event with an attendee; Outlook receives the invitation |
| MTD-OA-009 | Delete an event (opens a browser confirm box Claude cannot answer, MTD-101) |
| MTD-OA-011 | Contacts export, import and Email |
| MTD-OA-014 to 022 | Admin console pages, invitation, Support shared mailbox, Send as, live "is replying now", Not replied filter, reset and suspend, audit log, owner protections |

## Observations (not blocking, logged as MTD-101)

- Delete event, delete contact, Add category and discard email use the browser's own confirm or prompt box, not an in-app dialog.
- Contact form fields have no accessible labels.
- The Contacts ribbon cuts off "Export" at 1024 px wide.

## Test data left in test@

- Contact "Juan UAT-OA010 Dela Cruz" (favorite, category UAT) and "Sample Contact".
- Calendar event "MailTide calendar test" on 28 Nov.
- The two "Thread view check" emails are now in Archive. "Show emails one by one" is on for that browser.

## Not run in this session

The five older workbooks were not run: port split (MTD-40), delivery switch (MTD-50) and MailTide outbound (MTD-57) need the mail server or the owner's mailboxes; mail core 0.1.3 (MTD-15) and conversation view 0.3.0 (MTD-94) were written for the old screens and need updating to the 0.5 layout before a run means anything.

## Recommendation

Ready with conditions: nothing in scope is failing, but 14 cases, including every admin and shared-mailbox case, still need the owner's run before MTD-81 can close.
