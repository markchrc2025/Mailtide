# Spike S-6: what Sentire Cloud already has for MailTide's P3A (28 Nov 2026)

Issue: MTD-58. Read from `markchrc2025/sentire-cloud` at commit `e280cf6` (main) and Sentire Projects (CLD). Staging answers at https://sentire-cloud-staging.apps.sentire.solutions/api/health (200, version 1.0.0). Production (`cloud.sentire.solutions`) did not answer when checked; CLD shows Phases 1 to 4 in review with staging UAT cases still failing.

## Finding in one paragraph

Sentire Cloud already has most of what P3A planned to build: accounts with two-factor sign-in, organizations, memberships, invitations, an OpenID Connect provider, a product catalog, subscriptions, statements, PayMongo and Maya adapters, dunning, entitlements, staff overrides, the paywall card and an audit log. P3A is therefore mostly an integration job for MailTide, not a build of accounts and billing. The work that remains is: a Mail product in the catalog, three decisions where Cloud and the MailTide plan disagree, and one hard design problem (how MailTide opens a mailbox when the person signed in with a Sentire Account and not the mailbox password).

## P3A tasks against what exists

| P3A task | In Sentire Cloud today | Left to do |
|---|---|---|
| MTD-59 Organizations, memberships, roles, invitations, audit | Organizations (with TIN, VAT status), memberships, per-app access, invitations that expire in 7 days, "only an Owner invites an Owner", last-Owner guard, append-only audit | Roles differ, see Gap 1 |
| MTD-60 Products, plans, entitlements, Free plan, subscriptions | Products, plans with limits, add-ons, versioned prices, feature grants, subscriptions, entitlements per org and app with a version number and a change event | Only Ledger is seeded. Add the Mail product, plans and features. Free plan: see Gap 2 |
| MTD-61 Payments, webhooks, BIR invoices | Checkout sessions, PayMongo and Maya adapters, test provider, webhooks, billing statements with PDF, withholding and Form 2307 tracking, credit notes | Adapters are untested with real sandbox keys (CLD-18, owner). Statements are billing statements, not yet BIR-registered invoices |
| MTD-62 Failed payment | Reminders on day 0, 3 and 7; suspended on day 8; cancelled on day 30; staff can extend grace | MailTide must map Cloud's states to mail behaviour, see Gap 4 |
| MTD-63 Complimentary plans and overrides | Entitlement overrides by staff: features, limits, forced state, reason, optional expiry, audited | No "Complimentary" plan as such; an override does the same job. Staff roles differ, see Gap 1 |
| MTD-64 Sign-in with Sentire Account, organization switcher | OIDC provider (PKCE, ES256, key rotation), claims `org_id`, `org_role`, `app_access`, entitlement summary; choose-organization page | MailTide is not in the app registry. Mailbox access problem, see Gap 3 |
| MTD-65 Paywall points | `GET /api/v1/paywall/card`, upgrade page with return link, "ask my Owner" requests, paywall event counts | Call it from MailTide at each locked feature (own domain, extra mailboxes, shared mailboxes if gated) |
| MTD-66 Role mapping to mailcow and Postal | Nothing (MailTide-side by design) | Build in MailTide: replace tonight's local roles table with the `org_role` claim |
| MTD-67 Entitlement sync to mailcow quotas and Postal limits | Entitlements API, `account.entitlement.changed` event, signed delivery to an app's event endpoint | Build the receiver in MailTide and apply quotas and send limits through the mailcow API |

## Gaps and conflicts

**Gap 1: roles do not match.** MailTide's design has 5 customer roles (Org Owner, Org Admin, Billing Manager, Developer, Member) and 4 staff roles (Platform Owner, Platform Admin, Support, Billing Officer). Cloud has 4 customer roles (OWNER, ADMIN, BILLING, MEMBER) and 2 staff roles (PLATFORM_ADMIN, SUPPORT). Missing in Cloud: Developer, Platform Owner, Billing Officer. Options: add the roles to Cloud (schema change, touches Ledger's claims), or keep Cloud's roles and treat Developer as a per-app permission inside MailTide.

**Gap 2: free plan.** MailTide's decision (25 Nov) is a free plan: 1 mailbox, 5 GB, 50 sends per hour. Sentire Cloud's decision (25 Nov) is "no free tier". Cloud's `subscribe` always creates a statement to pay, and an organization with no live subscription computes to state OFF. A free Mail plan needs either a zero-price plan that activates without payment, or a rule in MailTide that "no subscription" means the free limits.

**Gap 3: mailbox access after single sign-on (the hard one).** MailTide today signs in with the mailbox address and password and keeps them in the session, because IMAP, SMTP and CalDAV need them. With Sentire Account sign-in MailTide never sees that password. It then needs another way in: a Dovecot master user that MailTide alone holds (the same idea already used for shared mailboxes, where MailTide holds a sealed credential), or a per-user app password created at link time. This decides how much of MTD-64 is new work and needs a short design before coding.

**Gap 4: suspension behaviour.** Cloud's entitlement states are ACTIVE, READ_ONLY and OFF. MailTide's plan is: stop sending first, then receive-only, then close. A mapping is needed (for example PAST_DUE = normal with a banner, SUSPENDED = receive-only, CANCELLED = sign-in to export only).

**Duplicate built tonight.** MailTide 0.5.0 has its own roles table, invitations and audit log (database `mailtide_web`). They work without Cloud, which is why the admin console could ship now. When P3A lands, roles and invitations should come from Cloud and the local tables retire; the mail-specific audit entries can stay local.

## What this does to the P3A estimate

P3A was 13 tasks written as if accounts and billing had to be built. With Cloud as it stands, tasks MTD-59, 60, 61, 62 and 63 shrink to configuration plus the gaps above, and the real build is MTD-64 (sign-in and mailbox access), MTD-66 and MTD-67. P3A cannot be finished before Sentire Cloud production is live, so it now depends on CLD's remaining UAT failures and on CLD-18 (payment sandbox keys).

## Decisions for the owner

1. **Roles (Gap 1).** Recommended: keep Cloud's four customer roles and make Developer a MailTide permission, add Platform Owner in Cloud only if you want a role above Platform Admin. It avoids changing claims Ledger already uses.
2. **Free plan (Gap 2).** Recommended: MailTide treats "no Mail subscription" as the free limits. No change to Cloud's billing, and "no free tier" stays true for the paid apps.
3. **Mailbox access (Gap 3).** Recommended: a Dovecot master user held only by MailTide, with every use audited. One credential to protect, nothing for users to set up.
4. **Order of work.** Recommended: finish Sentire Cloud's staging UAT and go to production first; MailTide's P3A integration follows. Until then MailTide keeps mailbox-password sign-in and its local roles.
