# CrimeLens Backend Engineering Rules

## Scope

These rules apply to all work inside `db-project-backend/`.

The backend is a Node.js + Express + Sequelize API using PostgreSQL/Supabase and PostGIS.

The backend is being evolved into a scalable, observable, secure modular monolith.

---

# 1. Before Changing Backend Code

Before implementation:

1. Inspect the relevant route.
2. Inspect middleware.
3. Inspect controller/service logic.
4. Inspect Sequelize models.
5. Inspect relevant database schema/indexes.
6. Search for existing implementations.
7. Inspect existing tests.
8. Identify frontend consumers of affected APIs.

Do not assume an infrastructure feature is absent because no obvious dependency exists.

Verify actual runtime usage.

---

# 2. Mandatory Validation

After every backend implementation task:

```text
ESLint
↓
TypeScript/type validation
↓
Unit tests
↓
API/integration tests
↓
Production build
```

For infrastructure-specific changes also run the relevant feature tests.

A phase cannot be considered complete with known failing tests unless the failure is explicitly documented and approved.

---

# 3. API Contract Safety

Preserve existing API contracts unless explicitly changing them.

Before changing an endpoint:

* Find all callers.
* Check authentication requirements.
* Check authorization behavior.
* Check request validation.
* Check response structure.
* Check error responses.

Avoid unnecessary breaking changes.

---

# 4. Database Rules

CrimeLens uses PostgreSQL/Supabase with PostGIS.

Before modifying database access:

* Inspect existing indexes.
* Inspect relationships.
* Inspect query patterns.
* Check for existing pagination.
* Check connection-pool configuration.

Do not add indexes blindly.

For important performance queries, use:

```sql
EXPLAIN ANALYZE
```

when practical.

When adding pagination, ensure queries have deterministic ordering.

When scaling horizontally, reassess total database connections:

```text
API instances × connections per instance
```

must remain within the database's capacity.

---

# 5. Redis Rules

Redis is shared infrastructure.

Use it for:

* Cache-aside caching
* Distributed rate limiting
* BullMQ infrastructure

Every cache implementation must define:

* Key format
* TTL
* Serialization
* Invalidation
* Failure behavior

The API should not become completely unavailable merely because a non-critical cache operation fails.

Never silently fall back to unsafe process-local state for distributed functionality.

---

# 6. Rate Limiting

Use Redis-backed/distributed rate limiting.

Do NOT implement a temporary in-memory rate limiter first.

Protect appropriate endpoints, particularly:

* Authentication
* Crime report submission
* Public APIs
* Abuse-sensitive endpoints

Test:

```text
Allowed requests → expected response
Limit exceeded → HTTP 429
Multiple API instances → shared limit
```

Rate limiting must not break legitimate normal traffic.

---

# 7. Health Checks

Maintain separate concepts where appropriate:

```text
/health
→ process is alive

/ready
→ required dependencies are available
```

Readiness should be able to verify important dependencies such as:

* PostgreSQL
* Redis once Redis is introduced

Health endpoints must not expose secrets or sensitive infrastructure details.

---

# 8. Security

For API security changes, consider:

* Helmet/security headers
* Strict CORS
* Request-size limits
* Schema validation
* Authentication
* Authorization
* Parameterized database queries
* Secure environment configuration

Never trust client-provided data.

Never log:

* Passwords
* JWTs
* API keys
* Service-role keys
* Database credentials
* Sensitive authentication data

---

# 9. Logging

Use Pino for structured logging once the logging phase is implemented.

Logs should include useful context such as:

* Timestamp
* Level
* Request ID
* HTTP method
* Route
* Status code
* Duration

Do not log sensitive data.

Do not leave temporary debugging logs in production code.

---

# 10. Monitoring

Expose only appropriate application metrics for Prometheus.

Useful metrics include:

* Request count
* Request duration
* Error count
* Database latency
* Redis/cache hit/miss
* Rate-limit events
* Worker/job metrics

Metrics must not contain secrets or sensitive user information.

---

# 11. Docker

The backend must work correctly inside its production container.

After Docker implementation:

```text
Build image
↓
Start container
↓
Health check
↓
Run API tests
↓
Verify database/Redis connectivity
```

Do not assume "Docker build succeeded" means the application works.

---

# 12. Nginx / Horizontal Scaling

The backend must remain stateless.

Before running multiple instances verify:

* JWT/authentication behavior
* Redis-backed state
* No important process-local state
* File/media handling
* Temporary data handling
* Database connection pools

Test:

```text
1 API instance
↓
2 API instances
↓
3 API instances
```

Verify requests can safely reach any instance.

---

# 13. Background Jobs

Use BullMQ only for operations that genuinely benefit from asynchronous processing.

Current candidates:

### CSV processing

Move expensive CSV processing away from the request lifecycle where appropriate.

### Cloudinary deletion

Cloudinary cleanup can be processed asynchronously when appropriate.

### Email

Use a background job if the application has email notifications that do not need synchronous completion.

Every job should consider:

* Retry policy
* Failure handling
* Idempotency
* Duplicate execution
* Job status
* Dead/failing jobs

Do not introduce jobs merely for architectural complexity.

---

# 14. Performance Testing

Use k6 for load testing.

Important scenarios include:

* Crime map retrieval
* Statistics
* Search/filtering
* Crime details
* Crime submission
* Authentication where appropriate

Track:

* Concurrent users
* Requests/sec
* P50
* P95
* P99
* Error rate

Do not claim scalability numbers without actual test results.

---

# 15. Failure Testing

Infrastructure features must be tested under failure conditions.

Examples:

### Redis unavailable

Verify appropriate application behavior.

### Database unavailable

Verify health/readiness behavior and controlled errors.

### API instance unavailable

Verify Nginx stops routing traffic to the unhealthy instance.

### Worker failure

Verify BullMQ retry/error behavior.

### Rate-limit pressure

Verify excessive traffic receives `429` rather than exhausting backend resources.

---

# 16. Playwright MCP — Backend Integration Validation

Playwright MCP is available for end-to-end browser validation.

Backend changes do not automatically require Playwright.

Use it when a backend change can affect an existing user workflow.

## Playwright Required When Appropriate

Run browser-level regression tests after backend changes affecting:

* API response structures consumed by the frontend
* Authentication
* Authorization
* Crime reporting
* Crime retrieval
* Search/filtering
* Pagination
* Statistics
* Map data
* Media/thumbnails
* Rate-limit behavior visible to users
* Error responses visible in the UI

## Examples

### Pagination API

After changing pagination:

```text
Backend tests
    ↓
Start frontend + backend
    ↓
Playwright
    ↓
Verify list/map pagination works correctly
```

### Authentication

After modifying authentication:

```text
Backend auth tests
    ↓
Playwright login flow
    ↓
Verify authenticated UI
    ↓
Verify unauthorized access is blocked
```

### Rate Limiting

Do not use Playwright to perform high-volume traffic tests.

Use:

```text
k6 → load/rate-limit testing
Playwright → user-facing behavior
```

For example, Playwright may verify that the frontend handles an API `429` response appropriately.

## Infrastructure Changes

After major infrastructure changes such as Docker, Nginx, or horizontal scaling, perform a Playwright smoke test against the running application when practical.

Verify:

* Application loads
* Login works
* Important API-driven pages work
* Map works
* Crime data loads
* Critical user workflows still function

## Validation Principle

Backend tests verify backend correctness.

k6 verifies load behavior.

Playwright verifies that the **complete system still works from the user's perspective**.

Do not treat one as a replacement for the others.

---

# 17. Git Safety

Before significant backend changes:

* Review `git status`.
* Preserve user changes.
* Do not reset/discard unrelated work.
* Do not modify unrelated files.
* Review `git diff` after implementation.

Never commit secrets.

---

# 18. Backend Completion Checklist

Before declaring a backend task complete:

```text
[ ] Existing implementation inspected
[ ] API contract verified
[ ] Database impact reviewed
[ ] Security implications reviewed
[ ] ESLint passes
[ ] Type validation passes
[ ] Unit tests pass
[ ] Integration/API tests pass
[ ] Production build passes
[ ] Feature-specific tests pass
[ ] Regression tests pass
[ ] No secrets exposed
[ ] Git diff reviewed
```

Report actual test results.

Never state that a validation step passed unless it was actually executed.
