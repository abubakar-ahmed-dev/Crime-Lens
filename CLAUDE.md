# CrimeLens — Engineering & System Design Rules

## 1. Project Context

CrimeLens is a PERN-based crime mapping and analytics application.

Repository structure:

```text
/
├── frontend/       # React + TypeScript + Vite application
├── backend/        # Node.js + Express + Sequelize API
└── CLAUDE.md       # Global engineering rules
```

The project is being progressively upgraded from a university project into a production-style, scalable modular monolith.

The goal is to improve:

* Performance
* Reliability
* Security
* Scalability
* Observability
* Testing
* Deployment
* Operational readiness

without unnecessarily rewriting existing functionality or converting the application into microservices.

---

# 2. Core Engineering Principles

You MUST follow these principles for all implementation work.

### Preserve Existing Functionality

Do not change existing business behavior unless the current phase explicitly requires it.

Before changing behavior, understand:

* Existing implementation
* Existing API contracts
* Database relationships
* Frontend expectations
* Authentication/authorization behavior
* Existing tests

### Minimal, Focused Changes

Each phase must have a clearly defined scope.

Do NOT:

* Perform unrelated refactoring
* Rename unrelated files
* Rewrite working modules unnecessarily
* Introduce technologies without a concrete requirement
* Change APIs unnecessarily
* Modify frontend behavior during a backend-only phase

### Evidence Before Implementation

Before implementing a feature:

1. Inspect the existing code.
2. Determine whether the feature already exists.
3. Identify the correct integration points.
4. Identify dependencies and side effects.
5. Only then implement the change.

Never assume a feature is missing merely because you have not seen it yet.

---

# 3. Phase-Based Implementation

System-design improvements are implemented ONE PHASE AT A TIME.

The current roadmap is:

1. k6 baseline testing
2. PostgreSQL / Sequelize optimization and pagination
3. Health checks
4. Redis caching
5. Redis-backed rate limiting
6. API security hardening
7. HTTP compression
8. Pino structured logging
9. Prometheus + Grafana monitoring
10. Docker
11. Nginx
12. Horizontal API scaling
13. BullMQ background workers
14. Cloudflare
15. GitHub Actions CI/CD
16. Final k6 scalability testing

Do not implement future phases early unless the current phase genuinely requires a small prerequisite.

Do not combine multiple phases into one implementation unless explicitly instructed.

---

# 4. Mandatory Phase Workflow

Every phase MUST follow this lifecycle:

```text
1. Inspect
      ↓
2. Plan
      ↓
3. Implement
      ↓
4. Lint
      ↓
5. Typecheck
      ↓
6. Unit / Integration Tests
      ↓
7. Feature-Specific Tests
      ↓
8. Build
      ↓
9. Regression Check
      ↓
10. Review Changes
      ↓
11. Phase Report
```

Never skip validation simply because the change appears small.

If a required check cannot be executed, clearly report why.

---

# 5. Before Making Changes

Before implementation:

* Inspect relevant files.
* Inspect package.json files.
* Inspect configuration.
* Inspect database schema/migrations.
* Inspect existing tests.
* Search for existing implementations.
* Check how the frontend and backend currently interact.
* Check environment variables required by the feature.
* Identify potential backward-compatibility issues.

Do not start coding immediately after reading only one or two files.

---

# 6. Testing Requirements

After every meaningful implementation:

### Required

* ESLint
* TypeScript type checking
* Relevant unit tests
* Relevant integration/API tests
* Production build

### When applicable

Also run:

* Database tests
* Redis tests
* Authentication/authorization tests
* Security tests
* Docker build/start tests
* Nginx routing tests
* Worker/queue tests
* Load tests
* Health-check tests

Existing tests must continue to pass.

Never delete or weaken a test merely to make the implementation pass.

---

# 7. Regression Protection

After every phase verify that existing functionality still works.

Pay particular attention to:

* Authentication
* Authorization
* Crime reporting
* Crime retrieval
* Map functionality
* Statistics
* Search/filtering
* Media upload
* Media thumbnails
* Admin functionality
* Police functionality
* Citizen functionality

If a regression is discovered:

```text
STOP
↓
Investigate
↓
Fix
↓
Re-run tests
↓
Continue
```

Do not proceed to the next phase with known regressions.

---

# 8. System Design Rules

### Redis

Redis must be treated as shared infrastructure.

Do not use process-local memory for functionality that must work across multiple API instances.

Caching should use an explicit strategy:

```text
Cache lookup
    ↓
HIT → return cached data

MISS
    ↓
Database
    ↓
Store in Redis
    ↓
Return response
```

Every cache must have:

* Key strategy
* TTL
* Invalidation strategy
* Failure behavior

The application must continue functioning appropriately if Redis becomes temporarily unavailable.

### Rate Limiting

Use Redis-backed/distributed rate limiting.

Do NOT implement a temporary in-memory rate limiter and later replace it.

Rate limits must be appropriate for:

* Authentication
* Crime report submission
* Public APIs
* Other abuse-sensitive endpoints

Verify both allowed requests and HTTP 429 behavior.

### Horizontal Scaling

The backend must remain stateless.

Do not introduce important application state into Node.js process memory.

Before scaling API instances:

* Verify authentication behavior
* Verify Redis sharing
* Verify database connection pools
* Verify uploaded-file handling
* Verify temporary state handling

### Database

Do not add indexes blindly.

Use actual query patterns and, where practical:

```sql
EXPLAIN ANALYZE
```

Connection pool settings must be reconsidered when multiple API instances are introduced.

Total possible database connections must remain within the database's capacity.

### Background Jobs

Only move genuinely suitable operations to BullMQ/workers.

Current candidates include:

* CSV processing
* Cloudinary file deletion
* Email notifications if applicable

Do not introduce background jobs solely for resume value.

Jobs must consider:

* Retries
* Failure handling
* Idempotency
* Duplicate execution
* Job status

---

# 9. Security Rules

Never expose:

* API keys
* JWT secrets
* Database passwords
* Supabase service keys
* Cloudinary secrets
* Redis credentials
* Other credentials

Never hardcode secrets.

Validate untrusted input.

Preserve existing authentication and authorization behavior.

Any change affecting authentication must include regression testing for all relevant roles.

---

# 10. Environment Configuration

When introducing infrastructure such as Redis, Docker, Nginx, or monitoring:

* Document required environment variables.
* Provide safe example values/placeholders.
* Never commit secrets.
* Preserve development/production separation.
* Do not silently change existing environment variable names.

---

# 11. Performance Work

Do not claim performance improvements without measurement.

For performance-sensitive phases:

```text
Measure
  ↓
Change
  ↓
Measure again
  ↓
Compare
```

Use k6 for application-level load testing.

Record:

* Requests/sec
* P50 latency
* P95 latency
* P99 latency
* Error rate
* Concurrent users

For relevant infrastructure also record:

* CPU
* Memory
* Database load
* Database connections
* Redis performance
* Cache hit rate

---

# 12. Observability

Production behavior should be measurable.

Use:

* Pino for structured logs
* Request/correlation IDs
* Prometheus for metrics
* Grafana for dashboards

Important metrics include:

* Request rate
* Error rate
* P50/P95/P99 latency
* Database latency
* Database connections
* Redis/cache hit rate
* Rate-limit violations
* Process/system resource usage

Do not add metrics that are not useful for diagnosing system behavior.

---

# 13. Infrastructure Changes

Infrastructure changes must be tested independently before depending on them for application behavior.

For Docker:

```text
Build → Start → Health check → Application test
```

For Nginx:

```text
Start → Routing test → Load distribution test → Failure test
```

For horizontal scaling:

```text
1 instance → baseline
2 instances → compare
3 instances → compare
```

For Redis:

```text
Connect → Cache test → Failure test → Recovery test
```

---

# 14. No Overengineering

CrimeLens should remain a **modular monolith**.

Do not introduce:

* Kubernetes
* Microservices
* Kafka
* Service mesh
* Event sourcing
* CQRS
* Elasticsearch

unless a genuine project requirement is identified and explicitly approved.

Use the simplest architecture that demonstrates the required engineering concept correctly.

---

# 15. Git Safety

Before significant changes:

* Review current git status.
* Do not overwrite unrelated user changes.
* Do not reset/discard user work.
* Do not modify unrelated files.
* Keep changes logically grouped by phase.

Before completing a phase:

* Review `git diff`.
* Confirm only intended files changed.
* Ensure no secrets or debugging artifacts were added.

---

# 16. Phase Completion Report

After completing each phase, provide a concise report containing:

### Implemented

What was changed.

### Files Changed

Only the important files.

### Validation

List the checks actually executed and their results.

Example:

```text
ESLint: PASS
TypeScript: PASS
Unit tests: PASS (42/42)
Integration tests: PASS
Build: PASS
Feature test: PASS
```

### Issues

Any known limitations or unresolved issues.

### Next Phase

State the next planned phase.

Do not claim a test passed if it was not actually executed.

---

# 17. Playwright MCP — Browser Validation

Playwright MCP is available for browser-based validation.

Use it whenever a change can affect user-visible behavior.

## When Playwright Is Required

Run Playwright MCP validation after changes involving:

* React components
* Pages/routes
* Navigation
* Forms
* Authentication flows
* Authorization-dependent UI
* Crime map
* Map markers
* Search/filtering
* Pagination/infinite scrolling
* Statistics/dashboard UI
* Media/thumbnails
* API-driven frontend behavior
* Error/loading/empty states
* Responsive behavior
* Frontend configuration affecting runtime behavior

It should also be used for important end-to-end regression checks after infrastructure changes that could affect the running application.

## When Playwright Is Not Required

Playwright is normally unnecessary for:

* Backend-only refactoring
* Database-only changes
* Redis implementation with no frontend behavior change
* Logging changes
* Prometheus/Grafana configuration
* Internal worker changes
* Unit-test-only changes

Use judgment if the change could indirectly affect user-visible behavior.

## Required Browser Validation

For applicable changes:

```text
Implement
    ↓
Lint
    ↓
Typecheck
    ↓
Unit/Integration Tests
    ↓
Build
    ↓
Start application
    ↓
Playwright MCP
    ↓
Browser smoke/regression tests
```

## Browser Test Expectations

Do not only check that a page loads.

Test the relevant user workflow.

Examples:

### Authentication

```text
Open login
→ Submit valid credentials
→ Verify successful authentication
→ Verify expected authenticated UI
```

### Crime reporting

```text
Open report form
→ Enter valid data
→ Submit
→ Verify success state
→ Verify expected UI update
```

### Map

```text
Open map
→ Verify map renders
→ Verify markers/data load
→ Apply relevant filter
→ Verify displayed results change
```

### Pagination

```text
Open crime list
→ Verify first page
→ Navigate to next page
→ Verify different results
→ Verify loading/error/empty behavior
```

### Rate limiting

Do not attempt to generate high-volume load using Playwright. Use k6 for load testing.

Playwright should verify the user-facing behavior of a rate-limited request where appropriate.

## Failure Handling

If Playwright reveals a regression:

1. Stop the phase.
2. Investigate the cause.
3. Fix the implementation.
4. Re-run relevant automated tests.
5. Re-run Playwright.
6. Only then continue.

Never ignore a browser regression simply because backend/unit tests pass.

---

## 18. Agent Workflow & Change Safety

- Follow the phase plans under `Plans/` when implementing system-design work.
- Work on **one phase at a time**; do not implement future phases unless explicitly required.
- Inspect existing code and verify current behavior before making changes.
- After meaningful changes, run the applicable lint, typecheck, tests, build, Playwright, and/or k6 validation required by the phase.
- Do not proceed with known regressions or failing required checks without explicitly documenting them.
- Preserve existing functionality and avoid unrelated refactoring.
- Keep phase documentation concise and maintain the existing phase log rather than creating duplicate logs.
- Multiple agents work sequentially: **Implementation → Testing → Debugging → Testing**, repeating until validation passes.
- Do not have implementation, testing, and debugging agents modify the same files simultaneously.
- **Only the Implementation Agent may create commits or push to GitHub.** Testing and Debugging Agents must not commit, push, reset, or discard changes.
- Never commit secrets, credentials, generated sensitive data, or debugging artifacts.
- Review `git diff` and validation results before committing.


### Do Not Trust Previous Agent Claims

Agents must verify the current repository state themselves.

Do not assume that:

- a previous agent completed a feature
- a previous test passed
- a previous build succeeded
- a previous agent committed all changes
- documentation accurately reflects the current code

Use the repository, git diff/status, tests, and actual execution results as the
source of truth.

---

# 19. Final Rule

Correctness takes priority over speed.

When uncertain:

```text
Inspect → Verify → Test → Implement
```

not:

```text
Assume → Implement → Hope
```

The objective is not merely to add technologies.

The objective is to produce a measurable, reliable, maintainable, production-style CrimeLens system while preserving existing functionality.
