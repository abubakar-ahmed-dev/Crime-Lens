# CrimeLens Frontend Engineering Rules

## Scope

These rules apply to all work inside `db-project-frontend/`.

The frontend is a React + TypeScript + Vite application.

The frontend must remain compatible with the existing backend API unless the current phase explicitly requires an API contract change.

---

# 1. Before Changing Frontend Code

Before implementation:

1. Inspect the relevant component/module.
2. Search for existing implementations.
3. Understand its state management.
4. Understand its API dependencies.
5. Check existing tests.
6. Check TypeScript types.
7. Identify possible regressions.

Do not rewrite components unnecessarily.

---

# 2. Mandatory Validation

After every frontend implementation task, run:

```text
ESLint
↓
TypeScript type-check
↓
Relevant unit/component tests
↓
Production build
```

If the project has additional frontend test commands, use them as appropriate.

A frontend task is NOT complete if linting, type checking, tests, or build fail.

Never suppress TypeScript errors merely to make the build pass.

---

# 3. Regression Checks

When modifying shared components, state, routing, API clients, or authentication, verify affected functionality including:

* Authentication
* Authorization-dependent UI
* Crime map
* Crime markers
* Crime filters/search
* Statistics
* Crime submission
* Media/thumbnails
* Admin/police interfaces
* Citizen interfaces

---

# 4. API Contract Safety

Do not silently change API requests or response expectations.

Before changing an API call:

* Inspect the backend endpoint.
* Confirm request parameters.
* Confirm response structure.
* Check authentication requirements.
* Check error behavior.

If a backend API changes, update the frontend only as part of the same explicitly scoped task.

---

# 5. Performance

Avoid unnecessary:

* Re-renders
* API requests
* Large client-side datasets
* Duplicate requests
* Expensive calculations during rendering

For pagination/infinite scrolling:

* Do not load the entire crime dataset into the browser.
* Preserve existing map behavior.
* Handle loading, empty, and error states.

For cached API responses:

* Do not create a second unrelated caching mechanism in the frontend unless required.
* Prefer the backend/Redis caching strategy for server-side data.

---

# 6. Error Handling

Every new API interaction should appropriately handle:

* Loading
* Success
* Empty result
* Authentication failure
* Authorization failure
* Validation errors
* Rate limiting (`429`)
* Server errors
* Network failures

Do not expose internal backend errors or secrets to users.

---

# 7. Environment Variables

Never hardcode:

* API URLs
* Credentials
* Secrets
* Service keys

Use the project's existing environment-variable conventions.

Do not rename existing variables without explicit approval.

---

# 8. System-Design Feature Integration

When backend infrastructure changes:

### Pagination

Frontend must correctly support:

* page/limit or cursor parameters
* loading state
* empty results
* continuation/end-of-results

### Rate Limiting

Handle `429 Too Many Requests` gracefully.

Do not create aggressive automatic retry loops.

### Health/availability

Do not repeatedly poll health endpoints from normal user-facing components unless explicitly required.

### Monitoring

Do not expose internal Prometheus metrics directly through the frontend.

### Cloudflare/CDN

Do not bypass CDN/media optimization unnecessarily.

---

# 9. Testing Rule

Do not change or remove existing tests just to make new code pass.

When fixing a bug:

1. Reproduce it.
2. Add or update an appropriate test.
3. Implement the fix.
4. Run the full relevant test suite.
5. Run lint/typecheck/build.

---

# 10. Playwright MCP Validation

Playwright MCP is the primary browser-level validation tool for frontend changes.

## Required For

Use Playwright after changes involving:

* Pages
* Components
* Routing/navigation
* Forms
* Authentication
* Authorization UI
* Crime map
* Map markers
* Search/filtering
* Pagination
* Statistics
* Media/thumbnails
* API-driven UI
* Loading/error/empty states
* Responsive layouts

## Frontend Validation Pipeline

For applicable changes:

```text
Code change
    ↓
ESLint
    ↓
TypeScript
    ↓
Unit/component tests
    ↓
Production build
    ↓
Start application
    ↓
Playwright MCP
    ↓
Relevant browser workflow
```

All applicable stages must pass before completing the task.

## Browser Testing Rules

Test actual user workflows rather than only checking whether elements exist.

Verify where relevant:

* Page loads successfully
* Correct data appears
* Forms work
* Navigation works
* API failures are handled
* Loading states work
* Empty states work
* Authentication state is correct
* Authorization restrictions are respected
* Map interactions work
* Pagination/filtering produces correct results
* Media/thumbnails render correctly

## Regression Testing

When modifying shared components or global state, test the affected workflows and important surrounding functionality.

Do not perform large amounts of load testing with Playwright.

Use **k6** for:

* Concurrent users
* Requests/sec
* Stress testing
* Spike testing
* Endurance testing

Use Playwright for:

* User workflows
* Browser behavior
* UI correctness
* End-to-end regression

## Test Evidence

When completing a frontend task, report:

```text
ESLint: PASS/FAIL
TypeScript: PASS/FAIL
Unit tests: PASS/FAIL
Build: PASS/FAIL
Playwright: PASS/FAIL
```

Never claim Playwright validation passed unless it was actually executed.


---

# 11. Completion Checklist

Before declaring a frontend task complete:

```text
[ ] Existing behavior understood
[ ] Minimal changes made
[ ] ESLint passes
[ ] TypeScript passes
[ ] Relevant tests pass
[ ] Production build passes
[ ] API contracts verified
[ ] No secrets added
[ ] No unrelated files changed
[ ] Git diff reviewed
```

Report the actual results. Never claim checks passed without running them.
