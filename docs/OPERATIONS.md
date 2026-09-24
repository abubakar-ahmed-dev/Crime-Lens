# Operations Runbook

Day-2 operations for the compose stack. All commands run from the repo root.

## Start / stop / rebuild

```bash
# full stack (local override ports: edge 18000, replicas 15001-15003)
docker compose -f docker-compose.yml -f docker-compose.override.yml up -d --build

# stop (keeps images)
docker compose -f docker-compose.yml -f docker-compose.override.yml down

# one service
docker compose -f docker-compose.yml -f docker-compose.override.yml up -d --build backend
```

Health after any change:

```bash
curl http://localhost:18000/api/health   # liveness
curl http://localhost:18000/api/ready    # DB + Redis readiness
docker ps --format "{{.Names}} {{.Status}}"
```

## Scaling API replicas

```bash
bash scripts/scale-backend.sh 3     # scale + edge restart + per-replica probes
```

Notes (measured in phase 11/16):

- The OSS nginx edge resolves the upstream DNS at startup — **restart the
  edge after every replica-count change** (`docker compose restart nginx`).
- Host port assignment uses the `15001-15003` range in creation order; never
  assume a specific replica owns a specific port — probe the range.
- Pool budget: `instances × DB_POOL_MAX(10)` must stay ≤ Supabase
  `max_connections` (measured 60).

## Connection-pool analysis

```bash
node scripts/analyze-db-pool.js
```

Reports live pool state (`used/available/waiting`), Supabase
`max_connections`, and current server-side connections. Prefer this over
guessing pool sizes.

## Cache operations

App cache keys live under `crimelens:*` (registry in
`db-project-backend/config/redis.js`); rate-limit keys under
`crimelens:rl:*`; BullMQ under `bull:*`. **Never `FLUSHALL`** — flush only
the cache namespace:

```bash
# inside the compose redis container
docker exec crimelens-main-redis-1 redis-cli --scan --pattern 'crimelens:stats:*'
docker exec crimelens-main-redis-1 redis-cli --scan --pattern 'crimelens:stats:*' \
  | xargs -r docker exec -i crimelens-main-redis-1 redis-cli del
```

Cache TTLs are 5 minutes; explicit invalidation also runs on writes
(`PATTERN_STATS` / `PATTERN_CRIMES`).

## Queue operations

```bash
# queue depth (waiting/active/completed/failed)
curl -H "Authorization: Bearer <admin-jwt>" http://localhost:18000/api/jobs/queues

# single job status
curl -H "Authorization: Bearer <admin-jwt>" http://localhost:18000/api/jobs/status/<jobId>

# worker logs
docker compose -f docker-compose.yml -f docker-compose.override.yml logs worker
```

Failed jobs keep their retry history in the `failed` depth counter; the
Cloudinary-cleanup job is idempotent, so reprocessing is safe.

## Failure drills (expected behavior)

| Drill | Expected |
|---|---|
| Stop Redis (`docker stop crimelens-main-redis-1`) | API stays up; cache reads fall through to DB; rate limiting fails open with an in-memory insurance limiter (1 s consume timeout); `/ready` reports Redis down |
| Kill one replica | nginx `max_fails=3 fail_timeout=30s` passive health check stops routing to it; traffic flows to remaining replicas |
| Stop worker | Enqueues keep succeeding (producer connection has a 5 s command timeout); jobs wait in queue and process when the worker returns |
| DB unreachable | `/ready` → 503; `/health` stays 200; request errors logged with request IDs |

## Load testing

```bash
cd db-project-backend/tests/k6
API_BASE_URL=http://localhost:18000 k6 run smoke-test.js       # sanity
API_BASE_URL=http://localhost:18000 k6 run runs/baseline.js    # 16-min mixed profile
```

Credentials come from `.k6.env` (gitignored) — see SETUP.md. Rate limiting
is part of the system under test: leave it ON for limit verification, disable
it via the backend env for raw capacity measurement (documented in the
compose override).
