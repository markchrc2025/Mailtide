#!/bin/bash
# Postal and MailTide P1: keep existing Postal SMTP clients working on port 25
# after mailcow takes port 25. Connections to port 25 from the app server and
# from the Beszel network are redirected to Postal on 2587, so PH CAS,
# Sentire Helpdesk and Beszel need no change. Everyone else on port 25 reaches
# mailcow (inbound MX).
# Usage: port25-redirect.sh apply | remove | status
# Idempotent. Rules go at the top of nat PREROUTING, before Docker's DNAT.
set -euo pipefail
SOURCES=("91.90.80.4/32" "172.31.250.0/24")
TAG="postal-p25-redirect"
rule() { echo "-s $1 -p tcp --dport 25 -m comment --comment $TAG -j REDIRECT --to-ports 2587"; }
case "${1:-status}" in
  apply)
    for s in "${SOURCES[@]}"; do
      # shellcheck disable=SC2046
      if iptables -t nat -C PREROUTING $(rule "$s") 2>/dev/null; then
        # make sure it sits above the DOCKER jump
        pos=$(iptables -t nat -L PREROUTING --line-numbers -n | awk -v t="$TAG" -v s="${s%/32}" '$0~t && $0~s {print $1; exit}')
        dpos=$(iptables -t nat -L PREROUTING --line-numbers -n | awk '/DOCKER/ {print $1; exit}')
        if [ -n "$dpos" ] && [ "$pos" -gt "$dpos" ]; then
          iptables -t nat -D PREROUTING $(rule "$s"); iptables -t nat -I PREROUTING 1 $(rule "$s"); echo "moved $s above DOCKER"
        fi
      else
        iptables -t nat -I PREROUTING 1 $(rule "$s"); echo "added $s"
      fi
    done ;;
  remove)
    for s in "${SOURCES[@]}"; do
      while iptables -t nat -C PREROUTING $(rule "$s") 2>/dev/null; do iptables -t nat -D PREROUTING $(rule "$s"); echo "removed $s"; done
    done ;;
  status)
    iptables -t nat -L PREROUTING --line-numbers -n | grep -E "$TAG|DOCKER" || true ;;
  *) echo "usage: $0 apply|remove|status"; exit 2 ;;
esac
