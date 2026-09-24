# CrimeLens Backend

Express 5 + Node.js (ES modules) API for CrimeLens: Sequelize ORM over
PostgreSQL/PostGIS (Supabase), Redis (cache, rate limits, BullMQ), Cloudinary
media, Prometheus metrics, pino logging.

## Scripts

```bash
npm start          # node server.js (production-style boot)
npm run dev        # nodemon
npm run worker     # node worker.js (BullMQ background worker)
node --check server.js   # syntax sweep (what CI runs)
```

## Environment

Copy `.env-sample` to `.env` and fill in real values. Key variables:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Supabase Postgres connection string |
| `DB_SSL` | `false` only for local/CI plain Postgres (Supabase needs SSL) |
| `DB_POOL_MAX` / `DB_POOL_MIN` | Connection pool (default 10 / 0) |
| `JWT_SECRET` | Staff auth signing key (long random; avoid `$` — compose interpolates it) |
| `REDIS_URL` | Redis instance (cache + rate limits + queues) |
| `RATE_LIMIT_ENABLED` | Disable only for capacity measurement runs |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | Citizen auth + storage |
| `CLOUDINARY_*` | Media upload/delete |
| `CORS_ORIGINS` | Comma-separated allowed origins |
| `LOG_LEVEL` | pino level (default info) |

Full reference: [`docs/SETUP.md`](../docs/SETUP.md).

## Structure

```
server.js            # app entry: middleware chain, route mounting, metrics
worker.js            # BullMQ worker process (Cloudinary cleanup)
config/              # db, redis, queue, rate limiter, prometheus, logger
controllers/         # domain logic per area
routes/              # route modules with auth + rate-limit chains
middleware/          # auth (JWT + Supabase), rate limiting, validation
models/              # Sequelize models (Crime, Zone, media, submitters, ...)
validators/          # zod schemas
services/            # cacheService, and other shared services
tests/k6/            # load-test suites + shared lib (see below)
```

## Load testing

k6 suites live in `tests/k6/`:

```bash
k6 run tests/k6/smoke-test.js                 # endpoint sanity
k6 run tests/k6/runs/baseline.js              # 16-min mixed profile (reads+auth+writes)
k6 run tests/k6/runs/rate-limit-final.js      # limiter tier verification (limiter ON)
```

`API_BASE_URL` targets the stack (default `http://localhost:5001`; use the
nginx edge `http://localhost:18000` for the full shape). Credentials come
from `tests/k6/.k6.env` (gitignored) — never hardcode or commit them.

## Ops entry points

- Pool analysis: `node ../scripts/analyze-db-pool.js`
- Runbook: [`docs/OPERATIONS.md`](../docs/OPERATIONS.md)
- Metrics reference: [`docs/OBSERVABILITY.md`](../docs/OBSERVABILITY.md)
