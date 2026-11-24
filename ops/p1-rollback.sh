#!/bin/bash
# P1 rollback: Postal back on 25, mailcow back on 2526, transports to 10025.
# Takes about 2 minutes. Run as root on the mail server.
set -euo pipefail
B=${1:?usage: p1-rollback.sh <backup dir with postal.yml and mailcow.conf>}
cp -a "$B/mailcow.conf" /opt/mailcow-dockerized/mailcow.conf
cd /opt/mailcow-dockerized && docker compose up -d postfix-mailcow
cp -a "$B/postal.yml" /opt/postal/config/postal.yml
docker restart postal-smtp-1
K=$(grep -E "^API_KEY=" /opt/mailcow-dockerized/mailcow.conf | cut -d= -f2)
for id in 1 2 3 4 5; do
  curl -sk -X POST -H "X-API-Key: $K" -H "Content-Type: application/json" \
    -d "{\"items\":[\"$id\"],\"attr\":{\"nexthop\":\"[172.22.1.1]:10025\"}}" https://127.0.0.1:8443/api/v1/edit/transport >/dev/null
done
ufw allow proto tcp from 172.22.1.0/24 to any port 10025 comment "mailcow to Postal (rollback)" >/dev/null
/opt/postal/ops/port25-redirect.sh remove
systemctl disable --now postal-p25-redirect.timer 2>/dev/null || true
ss -ltnp | grep -E ":(25|2526|2587) "
echo "Rollback done. Check: each app sends, Gmail to Postal route."
