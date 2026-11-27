# MailTide Mail plan prices: proposal for the owner's decision (28 Nov 2026)

Issue: MTD-19. This is a proposal, not a decision. Prices are for mail on the customer's own domain, per mailbox per month. All competitor figures were read on 28 Nov 2026 from the pages named; where a page is old or a reseller's, it says so.

## What the market charges in the Philippines

| Provider and plan | Price per mailbox per month | Storage | Source and note |
|---|---|---|---|
| Zoho Mail Lite | US$1 (about ₱56 to ₱65), yearly billing only, in dollars | 5 GB | toolradar.com (verified Oct 2026 from Zoho's page); truehost.ph gives about ₱56 |
| Zoho Mail Premium | US$4 | 50 GB | toolradar.com |
| Hostinger Mail Standard | ₱129 first term, renews at ₱79, on a 48-month term | 20 GB | hostinger.com/ph comparison page (dated 1 Jun 2026) |
| Hostinger Mail Premium | ₱209 first term, renews at ₱129, on a 48-month term | 50 GB | same page |
| Truehost PH (local) | from ₱26 | 3 to 50 GB | truehost.ph (their own listing, 147 days old) |
| Microsoft 365 Business Basic | about ₱190 to ₱350 | 50 GB mail plus 1 TB OneDrive | medhacloud.com lists ₱190 (page predates Microsoft's July 2026 increase); technica.ph gives ₱300 to ₱350 through resellers. Not confirmed on Microsoft's own PH page |
| Google Workspace Business Starter | US$7 on a yearly plan, US$8.40 monthly; ₱419 to ₱420 through resellers; about ₱511 to ₱611 with VAT | 30 GB pooled | workspace.google.com (PH page, dollars); hostinger.com/ph and web.z.com/ph for peso reseller prices; truehost.ph for the VAT-inclusive estimate |

Reading of the table: plain business mail sells at ₱56 to ₱130. Suites that include documents, meetings and 1 TB of files sell at ₱190 to ₱611. MailTide today is plain mail plus calendar, contacts and shared mailboxes, so it competes with the first group.

## What a payment costs Sentire

| Method | Fee | On a ₱99 payment | On a ₱990 yearly payment |
|---|---|---|---|
| Card through PayMongo | 3.5% + ₱15 (VAT-inclusive, developers.paymongo.com) | ₱18.47 (18.7%) | ₱49.65 (5.0%) |
| GCash through PayMongo | 2.5% (paymongo.com/gcash) | ₱2.48 | ₱24.75 |
| Percentage tax (non-VAT) | 3% of gross | ₱2.97 | ₱29.70 |

The fixed ₱15 card fee is the important number. A single ₱99 mailbox paid monthly by card nets about ₱77.56 after the fee and the 3% tax. Small monthly tickets lose almost a fifth to the gateway.

Cost to serve is not measured yet. The mail server is shared with Postal on 8 GB of RAM, and storage is the real limit. I have not checked the server's free disk, so the storage sizes below are proposals to confirm against capacity, not promises.

## Proposed plans

| Plan | Price | Includes | Why |
|---|---|---|---|
| Free | ₱0 | 1 mailbox on the shared domain, 5 GB, 50 sends per hour, 200 per day (already decided 25 Nov) | Unchanged |
| Mail Starter | ₱99 per mailbox per month, or ₱990 per mailbox per year | Own domain, 10 GB per mailbox, aliases, calendar, contacts | Above Zoho Lite and Hostinger's renewal price, with peso billing, GCash and local support as the reason to pay more. Double Zoho Lite's storage |
| Mail Business | ₱199 per mailbox per month, or ₱1,990 per year | 30 GB per mailbox, shared mailboxes with Send as, audit log, priority support | Matches Microsoft 365 Basic's low end without the office suite, so it must be sold on shared mailboxes and support, not on features Microsoft also has |

Two billing rules I recommend with these prices:

1. **Minimum of ₱297 per month on monthly billing** (three Starter mailboxes), or yearly billing for anything smaller. This keeps the card fee under about 9% of a monthly payment.
2. **Yearly price = 10 months.** It is the cleanest way around the fixed fee and it brings cash forward.

## What the numbers say, honestly

- Mail is a low-priced commodity. Ten organizations with five Starter mailboxes each is ₱4,950 a month before fees. It will not carry the company; Payroll's ₱700 to ₱950 per customer does that with one sale.
- The better use of MailTide is as part of a bundle that keeps Payroll and Ledger customers, and as the reason a customer puts their domain with Sentire. Priced alone against Zoho at US$1, it is hard to win on price.
- Risk that pricing cannot fix: one sending IP and one 8 GB server. A paying customer whose mail lands in spam or whose mailbox is down will leave and say why. P7 (hardening, off-server backup) should be done before the first outside paying domain.
- The storage sizes and the ₱199 tier are estimates. Replace them once the server's free disk and real mailbox sizes are known.

## Decisions for the owner

1. **Starter price.** Recommended: ₱99 per mailbox per month, ₱990 per year.
2. **Business price.** Recommended: ₱199 per mailbox per month, ₱1,990 per year, or leave this tier out at launch and sell one plan.
3. **Monthly minimum.** Recommended: ₱297 per month minimum on monthly billing; no minimum on yearly.
4. **Bundle.** Recommended: decide later, with Payroll's pricing, whether Payroll customers get Mail Starter mailboxes included.
