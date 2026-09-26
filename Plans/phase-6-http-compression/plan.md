# Phase 6: HTTP Compression

## Objective

Add HTTP response compression to the API to reduce bandwidth and transfer
time for large JSON responses (crime map, statistics, records), with
thresholds so small responses are not compressed, and measured before/after
numbers (CLAUDE.md §11: no performance claims without measurement).

## What We'll Implement

1. **gzip compression** of compressible API responses (JSON/text) via the
   `compression` middleware
2. **Brotli, if the installed `compression` version supports it** — decided
   at implementation time by inspecting the installed package (the `compression`
   package historically shipped gzip only; brotli support was added late in
   its lifecycle). Do not assume brotli works; verify empirically and document.
3. **Size threshold** — only compress bodies > 1KB
4. **Content-type filtering** — `compression`'s default filter (mime-db based)
   plus an `x-no-compression` request-header opt-out

## Non-Goals

- No `express-static-gzip` — it serves pre-compressed static files; this
  backend has no static file serving. Dead dependency.
- No custom response headers (`X-Content-Size`, `X-Compression-Enabled`) —
  the previous plan's header middleware set headers inside `res.on("finish")`,
  which runs AFTER the response is on the wire, so it could never work; and
  `Content-Length` at that point is the COMPRESSED size, so even the value it
  tried to report was wrong. Real size metrics come from the measurement step
  and, later, from Prometheus (phase 8), not from ad-hoc headers.

## Implementation Steps

### Step 1: Install dependency

```bash
npm install compression
```

(one package only; record installed version in the implementation log)

### Step 2: Wire middleware in `db-project-backend/server.js`

```javascript
import compression from "compression";

// After helmet/cors/json/sanitize, BEFORE health + API routes, so every
// route's response passes through it:
app.use(compression({
  threshold: 1024, // bytes — smaller responses are sent uncompressed
  filter: (req, res) => {
    // opt-out escape hatch for clients/proxies
    if (req.headers["x-no-compression"]) return false;
    // otherwise use compression's default mime-db content-type filter
    return compression.filter(req, res);
  },
}));
```

Notes:

- `compression` sets `Vary: Accept-Encoding` itself; do not add it manually.
- If (and only if) the installed version supports brotli, enable it in
  addition to gzip with a quality level around 4–5 (CPU/size balance), and
  document the exact options used. If it does not, gzip alone satisfies this
  phase — record the finding.
- Do not set `memLevel`/`level` explicitly unless a measured reason exists
  (defaults are fine; `memLevel: 8` in the old plan was already the default).
- The `compression` package DOES work on all Node versions we run; the old
  plan's "Brotli requires newer Node.js" comment was wrong either way.

### Step 3: CORS — no changes needed

Phase 5 already exposes the diagnostic headers that exist (`X-Cache`,
`X-RateLimit-*`). We add NO new headers in this phase, so `exposedHeaders`
stays untouched. (The old plan listed `X-Total-Count`, which has never
existed in this codebase.)

### Step 4: Measure (before AND after — mandatory)

CLAUDE.md §11 requires: Measure → Change → Measure → Compare.

On the real running backend, per endpoint, same payload:

```bash
# compressed (as a browser would receive it)
curl -s -o /dev/null -D - -H "Accept-Encoding: gzip, br" URL
# uncompressed (baseline)
curl -s -o /dev/null -D - -H "X-No-Compression: x" URL  # or Accept-Encoding: identity
```

Record in the implementation log for at least:

- `GET /api/crimes/` (map, legacy unpaginated response — the big one)
- `GET /api/crimes/types`
- `GET /api/zones/severity`
- `GET /api/stats/summary`

Metrics per endpoint: `Content-Length` (wire size), `Content-Encoding`,
`Vary` header, response time (curl `time_total`), plus before/after backend
CPU sanity check (e.g. Windows Task Manager / `node` process CPU% during a
short burst). State numbers, not adjectives. The old plan's "70–80%"
predictions were speculation and must be replaced by actual results.

## Testing

```bash
# 1. Compressed response on a large public endpoint (>1KB JSON):
curl -s -D - -o /dev/null -H "Accept-Encoding: gzip, br" http://localhost:5001/api/crimes/
#   Expected: Content-Encoding: gzip (or br), Vary: Accept-Encoding, small Content-Length

# 2. Same endpoint, compression declined:
curl -s -D - -o /dev/null -H "Accept-Encoding: identity" http://localhost:5001/api/crimes/
#   Expected: NO Content-Encoding, full-size Content-Length

# 3. Opt-out header:
curl -s -D - -o /dev/null -H "Accept-Encoding: gzip" -H "X-No-Compression: 1" http://localhost:5001/api/crimes/
#   Expected: NO Content-Encoding

# 4. Threshold: small response stays uncompressed
curl -s -D - -o /dev/null -H "Accept-Encoding: gzip" http://localhost:5001/api/stats/summary
#   Expected: NO Content-Encoding if body < 1KB (verify actual size first)

# 5. Non-compressible content (media thumbnail redirect) unaffected:
curl -s -D - -o /dev/null -H "Accept-Encoding: gzip" http://localhost:5001/api/media/<id>/thumbnail
#   Expected: 3xx without Content-Encoding

# 6. Browser-level: Playwright map/statistics flows still work (frontend
#    axios/fetch send Accept-Encoding: gzip, deflate, br by default)
```

Caveats the old plan got wrong:

- `curl -I` sends HEAD and omits `Accept-Encoding`; HEAD responses have no
  body, so it proves nothing about compression. Use the GET forms above.
- `/api/crimes/all` requires police auth — it 401s with a tiny body and is
  useless as a compression probe unless tested with a real token.
- Phase 4 rate limits apply to these endpoints (PUBLIC 50/min per IP) —
  space out or flush `crimelens:rl:*` between measurement bursts
  (Windows redis-cli: use `KEYS`/`DEL`, `--scan` is broken on 5.0.14).

## Interactions With Existing Phases (verify during implementation)

- **Phase 3 cache**: Redis stores UNCOMPRESSED JSON; compression happens at
  the HTTP layer per request. Cache HITs still pay compression CPU each time.
  Acceptable for this phase; note observed HIT latency in measurements.
- **Phase 4 rate limiting**: compression runs after the limiter; 429 JSON
  bodies are tiny and stay under threshold. No conflict.
- **Phase 5 helmet**: no header conflicts; `Vary` comes from compression.
  Order: helmet → cors → json → sanitize → compression → routes.
- **Media endpoints**: Cloudinary URLs/redirects are already compressed
  upstream; compression must not attempt to re-compress binary/redirect
  responses (default filter handles this — verify one upload-adjacent
  response).

## Success Criteria

- [ ] Responses > 1KB with compressible content-type and `Accept-Encoding:
      gzip` are compressed (`Content-Encoding` + `Vary` present)
- [ ] Responses below threshold, with `Accept-Encoding: identity`, or with
      `x-no-compression` are NOT compressed
- [ ] Measured wire-size reduction recorded per endpoint (log actual numbers)
- [ ] Latency/CPU impact measured and recorded; no pathological regression
      (e.g. P95 more than doubling) on the measured endpoints
- [ ] Browser regression via Playwright: map, statistics, login flows work
- [ ] Phase 3/4 behavior unchanged: `X-Cache` / `X-RateLimit-*` still present

## Files Modified

```
db-project-backend/
├── server.js          (modified — compression middleware + import)
├── package.json       (modified — compression dependency)
└── package-lock.json  (modified)
Plans/phase-6-http-compression/
└── implementation-log.md (new — includes before/after measurement table)
```

## Rollback

Remove the `app.use(compression(...))` line and the import from
`server.js`; optionally `npm uninstall compression`. No data, schema, cache,
or contract changes are involved, so rollback is trivial and complete.

## Estimated Completion Time

- Middleware + threshold config: 30 min
- Brotli support investigation: 15 min
- Measurement + testing (curl, Playwright, regression): 1–1.5 h
- **Total: ~2–2.5 h**
