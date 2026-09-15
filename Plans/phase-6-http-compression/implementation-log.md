# Phase 6 — HTTP Compression: Implementation Log

## Status: Implemented & Validated (API level; Playwright pending restart)

## What Was Implemented

- `db-project-backend/server.js` — `compression` 1.8.2 middleware added AFTER
  helmet/cors/json/sanitize and BEFORE health + API routes:
  - `threshold: 1024` (bodies < 1KB stay uncompressed)
  - custom `filter`: `x-no-compression` request-header opt-out, otherwise
    compression's default mime-db content-type filter
  - No `level`/`memLevel`/brotli overrides: gzip defaults apply, and
    compression 1.8.x already defaults brotli to quality 4 (verified in
    `node_modules/compression/index.js` — `BROTLI_PARAM_QUALITY = 4`), which
    matches the plan's CPU/size recommendation, so nothing was overridden.
- `package.json` / `package-lock.json` — `compression@^1.8.2`.

## Brotli Finding (per corrected plan)

Brotli IS supported by compression 1.8.2 (empirically probed: requests with
`Accept-Encoding: gzip, br` negotiate `br`; `gzip` alone negotiates `gzip`).
It is enabled by default — no extra options. Modern browsers send `br` and
receive brotli; legacy clients get gzip; `Accept-Encoding: identity` gets raw
bytes.

## Measurement (CLAUDE.md §11 — real numbers)

Baseline (user's :5001, pre-change code) vs after (:5092, this branch),
same Supabase/Redis backend, `curl` wire sizes:

| Endpoint | Before (wire) | After — br (wire) | After — identity | Reduction |
|---|---|---|---|---|
| `GET /api/crimes/` (map) | 7020 B | **1173 B** | 7020 B | **−83.3%** |
| `GET /api/zones/severity` | 1022 B | 1022 B (no enc, < 1KB threshold) | 1022 B | 0% (below threshold, by design) |
| `GET /api/crimes/types` | 180 B | 180 B (no enc) | 180 B | 0% (below threshold) |
| `GET /api/stats/summary` | 149 B | 149 B (no enc) | 149 B | 0% (below threshold) |

Latency (serial curl, warm cache, dev machine):

- Map compressed: 0.25–0.29 s/req — vs identity 0.25 s/req: no meaningful
  per-request cost on cached responses.
- Burst of 30 serial map requests: compressed ≈ 430 ms/req vs identity ≈
  351 ms/req (~+22% wall time). NOTE: `/api/crimes/` is DB-bound (not cached;
  per-crime media subqueries), so this delta includes DB variance; absolute
  cost ≈ +80 ms/req on a 7 KB payload. Proper CPU/P95 quantification comes
  with phase 8 metrics and phase 15 k6 — recorded here honestly, not hidden.
- With production-scale payloads the fixed ~1KB floor and per-request CPU
  become proportionally smaller; the 7KB dev dataset understates benefits.

## Validation Performed

- `node --check server.js`: PASS
- compression 1.8.2 capability probe (isolated server): br + gzip +
  negotiation + `Vary: Accept-Encoding` set by lib: PASS
- Curl matrix on :5092 (all PASS):
  - `Accept-Encoding: gzip, br` on map → `Content-Encoding: br`,
    `Vary: Origin, Accept-Encoding`
  - `Accept-Encoding: gzip` → `Content-Encoding: gzip` (fallback works)
  - `Accept-Encoding: identity` → no `Content-Encoding`, full 7020 B
  - `X-No-Compression: 1` → no `Content-Encoding` (opt-out works)
  - Sub-threshold responses (types 180 B, summary 149 B, severity 1022 B) →
    uncompressed, confirming the 1KB threshold boundary
  - `GET /api/media/1/thumbnail` → 404 (no such media in dev DB), no
    encoding attempted — redirect path itself not exercised (no media rows
    in dev data); non-JSON/binary bypass relies on the mime-db filter
- Phase regression on :5092 (all PASS):
  - Phase 3: `X-Cache: HIT/MISS` still present on cached endpoints
  - Phase 4: `X-RateLimit-Limit: 50` still present; limiter unaffected
  - Phase 5: security headers unchanged; validation gates fire (bad map date
    → 400, bad login shape → 400); 401s preserved on report-crime / update
  - CORS `exposedHeaders` untouched (no new headers this phase)

## Not Executed (with reason)

- Playwright: pending — requires the user to restart the :5001 instance onto
  this code; will verify map/statistics/login flows over compressed
  transport (browsers send `Accept-Encoding: gzip, deflate, br`).
- k6: deferred to phase 15 (final scalability testing); no load claims made.
- ESLint / TypeScript: backend has no ESLint config and is plain JS
  (pre-existing gap).

## Notes for Testing Agent

- The map endpoint is NOT Redis-cached (only stats/types/zones are) — do not
  expect `X-Cache` on `/api/crimes/`.
- `zones/severity` at 1022 B sits JUST under the 1024 B threshold; if data
  grows by 3+ bytes it will start compressing — that is correct behavior,
  not a bug.
- Latency comparisons on this dev dataset are noisy (DB-bound); use k6 for
  any performance verdicts.
- Rate-limit keys shared with any running instance — flush `crimelens:rl:*`
  between suites (Windows redis-cli `--scan` broken; use KEYS/DEL).
