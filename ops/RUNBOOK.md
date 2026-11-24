# Postal and MailTide ops runbook

Scripts in this folder are installed on the mail server (169.58.24.215) in `/opt/postal/ops/`. Build Plan v1.1, phases P0 to P2, done 25 Nov 2026 (Manila).

## Backups taken (P0.1)

| What | Where on the mail server |
|---|---|
| postal.yml, mailcow.conf, extra.cf, Caddyfile, ufw rules and /etc/ufw | `/opt/backups/p0-20261124-163240/` |
| Postal MariaDB dump (all databases, 264 tables) | `/opt/backups/p0-20261124-163240/postal-mariadb.sql.gz` |
| mailcow nightly backup | `/opt/mailtide-backup-root/backups/mailcow-2026-11-24-02-43-05` |
| postal.yml before the delivery switch and IP pools | `/opt/postal/config/postal.yml.bak-ippools-*`, `postal.yml.bak-delivery-*` |
| Old smarthost container (image postal-smarthost:3) | container `postal-smarthost-old`, stopped, restart=no |

## Who sends through Postal (P0.2, no secret values)

| Credential (Postal server sentire-prod) | Type | Used by | How it connects | Last used (UTC) |
|---|---|---|---|---|
| ph-cas | SMTP | PH CAS Site (Dokploy, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`) | app server 91.90.80.4 to port 25 | 2026-11-24 13:36 |
| sentire-helpdesk | SMTP | Sentire Helpdesk (Email Account inside Frappe, not in Dokploy env) | app server 91.90.80.4 to port 25 | 2026-11-11 16:52 |
| beszel-alerts | SMTP-IP | Beszel hub (172.31.250.10) | Beszel network to port 25 | 2026-11-08 16:00 |
| acctgfirm | API | MCRC Portal API (`POSTAL_API_URL`, `POSTAL_API_KEY`) | HTTPS | 2026-09-28 |
| thirdsideworks-website | API | Thirdside Works website | HTTPS | 2026-10-13 |
| api-test | API | zone-watch, blocklist-check, postal-delivery canary | HTTP on 127.0.0.1:5000 | in use |
| mailtideapi | API | unused | | never |
| sagd (server sagd) | SMTP | unused | | never |

Payroll sends with Resend, not Postal. Sentire Projects only has `MAIL_FROM`.

## Old Postal console (P0.3)

The July 2026 Postal console (console.sentire.solutions, `/opt/mailtide`) now runs as `postal-console` and `postal-console-postgres`. `docker-compose.yml` updated; backup next to it.

## SPF for sentireledger.com (P0.4)

Not done: `sentireledger.com` does not resolve (no NS, not registered or lapsed). Owner decision: register it, or remove it from Postal.

## Protected zones (P0.5)

zone-watch (`/opt/postal/zone-watch`, hourly) protects the apex MX and SPF of `sentire.solutions` and `mcrctas.com` (both Microsoft 365). Nothing in P0 to P2 changes them.

## Port split (P1)

| Port | Now |
|---|---|
| 25 | mailcow inbound (MX) for everyone, except connections from 91.90.80.4 and 172.31.250.0/24, which are redirected to Postal 2587 |
| 2587 | Postal SMTP (ufw: 172.22.1.0/24, 172.31.250.0/24, 91.90.80.4) |
| 2526 | closed |
| 10025 | closed (ufw rule removed) |

Why the redirect: PH CAS keeps its port in a Dokploy variable but Helpdesk keeps it inside Frappe, and Beszel in its own settings. The redirect lets all three keep sending to port 25 without a redeploy. They move to the Postal API in P6.3, after which the redirect can go.

- `port25-redirect.sh apply|remove|status`: idempotent iptables REDIRECT at the top of nat PREROUTING. Kept in place by `postal-p25-redirect.timer` (every 5 minutes, and at boot).
- mailcow transports for mail.sentire.solutions, mail.mcrctas.com, thirdsideworks.com, rp.postal.sentire.solutions and psrp.mail.sentire.solutions point to `[172.22.1.1]:2587`.

**Rollback (about 2 minutes):** `/opt/postal/ops/p1-rollback.sh /opt/backups/p0-20261124-163240`. That backup also turns IP pools off and puts SMTP2GO mode back, so after a rollback run `postal-delivery status` and re-apply P2 if wanted.

## Delivery switch (P2)

```
postal-delivery status
postal-delivery direct  --reason "why"
postal-delivery smtp2go --reason "why"
postal-delivery direct  --reason "seed test" --seed you@example.com
```

- Edits `smtp_relays` in postal.yml, restarts only `postal-worker-1`, sends a canary to `canary@mailtide.sentire.solutions` and waits up to 120 s for Sent. On failure it restores the backup.
- Log: `/var/log/postal-delivery.log`.
- Direct mode sends from IP pool `main-ipv4` (169.58.24.215 only, HELO `postal.sentire.solutions`), so Postal never sends over IPv6 (the IPv6 address has no matching PTR or SPF).
- The smarthost (image postal-smarthost:4) accepts 127.0.0.0/8 and 169.58.24.215, so SMTP2GO mode works with the pool.

## Limits and monitoring (P2)

- Send limits: 500 per hour on Postal servers sentire-prod and sagd.
- `blocklist-check` runs daily at 06:17 Manila (`blocklist-check.timer`). It checks Spamhaus ZEN, Barracuda, SpamCop, UCEPROTECT 1 and PSBL and emails `mcrc.business.solutions@gmail.com` through Postal on a listing. Test: `blocklist-check --ip 127.0.0.2`. Log: `/var/log/blocklist-check.log`.
- ses-webhook stays running for SMTP2GO mode.
