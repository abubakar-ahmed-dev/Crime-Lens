#!/bin/bash
# Scale the CrimeLens backend replicas (Phase 11).
#
# Usage: bash scripts/scale-backend.sh <1-3>
#
# IMPORTANT: the edge nginx resolves the `backend` DNS name once at startup,
# so it MUST be restarted after every scale change (phase-10 finding), or it
# keeps serving a stale replica IP.

set -e

N="${1:-1}"
MAX=3

if ! [[ "$N" =~ ^[0-9]+$ ]] || [ "$N" -lt 1 ] || [ "$N" -gt "$MAX" ]; then
    echo "Error: instances must be between 1 and $MAX" >&2
    exit 1
fi

echo "Scaling backend to $N replica(s)..."
docker compose up -d --scale backend="$N"

echo "Restarting edge nginx to re-resolve upstream DNS..."
docker compose restart nginx

sleep 8

echo "Health per replica (Docker assigns ports 15001-15003 from the local
override range in creation order — not one port per replica index):"
ok=0
for port in 15001 15002 15003; do
    if curl -sf "http://localhost:$port/api/health" > /dev/null 2>&1; then
        echo "  :$port healthy"
        ok=$((ok + 1))
    elif curl -s -o /dev/null "http://localhost:$port/api/health" 2>/dev/null; then
        echo "  :$port UNHEALTHY"
    fi
done
echo "Healthy: $ok (expected $N; unbound ports in the range answer nothing)"

echo "Edge check (through the LB):"
curl -sf "http://localhost:18000/api/health" > /dev/null \
    && echo "  edge :18000: healthy" \
    || { echo "  edge :18000: UNHEALTHY"; exit 1; }
