# Plans — Agent Workflow

This directory contains the implementation plans and execution records for
CrimeLens system-design phases.

Agents working on a phase MUST follow these instructions.

---

## 1. Agent Roles

There are three agent roles.

### Implementation Agent

Responsible for:

- Implementing the assigned phase according to `plan.md`.
- Inspecting the existing implementation before changing it.
- Making the required production-code changes.
- Running the validation appropriate for the implementation.
- Updating the phase `implementation-log.md`.
- Committing and pushing the completed implementation.

The Implementation Agent is the ONLY agent allowed to commit or push to GitHub.

The Implementation Agent must NOT modify the testing log except when explicitly
necessary to correct factual information about the implementation.

### Testing Agent

Responsible for:

- Reviewing the implemented feature.
- Creating or improving tests where required.
- Running unit, integration, API, Playwright, and performance tests as applicable.
- Testing expected behavior and important failure cases.
- Recording concise testing results in the phase `testing-log.md`.
- Clearly documenting any discovered defects so the Debugging Agent can investigate.

The Testing Agent MUST NOT:

- Commit changes.
- Push to GitHub.
- Reset or revert changes.
- Discard another agent's work.
- Modify the implementation log unless explicitly required to correct factual
  information.

The Testing Agent owns the testing record.

### Debugging Agent

Responsible for:

- Investigating failures reported by the Testing Agent.
- Finding the root cause rather than blindly patching symptoms.
- Fixing implementation problems.
- Running relevant validation after the fix.
- Updating the existing `implementation-log.md` to reflect implementation changes.

The Debugging Agent MUST NOT:

- Commit changes.
- Push to GitHub.
- Reset or revert unrelated changes.
- Modify unrelated functionality.
- Rewrite or remove testing results from `testing-log.md`.

After debugging, the Testing Agent must re-test the affected functionality and
update `testing-log.md`.

---

## 2. Agent Workflow

Agents work sequentially.

```text
Implementation
      ↓
Testing
      ↓
   PASS ─────────→ Phase Complete
      │
     FAIL
      ↓
  Debugging
      ↓
   Testing
      ↓
   PASS → Phase Complete
      │
     FAIL
      ↓
  Debugging
      ↓
     ...
```

Do NOT run Implementation, Testing, and Debugging agents simultaneously when
they may modify the same files.

The cycle continues until the required validation passes or an explicitly
documented issue is accepted.

### Important

The Testing Agent reports problems.

The Debugging Agent fixes problems.

The Testing Agent confirms whether the fixes actually work.

The Implementation Agent is responsible for the final commit and push.

---

## 3. Phase Plan

Before starting work:

1. Read the phase's `plan.md`.
2. Read the existing `implementation-log.md` and `testing-log.md` if they exist.
3. Inspect the relevant existing implementation.
4. Determine what is already implemented.
5. Identify the files and components that will be affected.
6. Follow the project's existing architecture unless the plan explicitly
   requires architectural changes.

Do not implement functionality that is outside the current phase.

If the implementation differs from the plan for a valid technical reason,
document the difference in the implementation log.

---

## 4. Phase Documentation

Each phase should maintain separate concise logs:

```text
phase-X/
├── plan.md
├── implementation-log.md
└── testing-log.md
```

### `implementation-log.md`

Contains the current implementation record.

It is maintained by:

* Implementation Agent
* Debugging Agent

It should describe:

* What was implemented
* Where it was implemented
* Why it was implemented
* Important implementation decisions
* Implementation-related validation
* Current implementation status

### `testing-log.md`

Contains the testing and validation record.

It is maintained by:

* Testing Agent

It should describe:

* Tests created or modified
* Tests executed
* Validation performed
* Pass/fail results
* Important failures
* Bugs discovered
* Retesting results
* Final testing status

The two logs have different purposes and must not be merged.

---

## 5. Implementation Log Rules

Keep `implementation-log.md` concise.

After meaningful implementation work, record:

* What was done
* Where it was done
* Why it was done
* Relevant validation
* Current status
* Important implementation issues or follow-ups

Example:

```markdown
### Redis Cache

- Status: Implemented
- Files: `statsController.js`, `cacheService.js`
- Change: Added cache-aside caching with TTL.
- Why: Reduce repeated statistics queries.
- Validation: API tests PASS.
```

Do NOT include:

* Long explanations
* Full command output
* Large code blocks
* Agent reasoning
* Repeated information
* Conversation transcripts

### Updating Existing Implementation

If a later agent changes an existing implementation:

1. Find the relevant existing entry.
2. Update that entry.
3. Briefly explain what changed and why.
4. Update its current validation/status.

Do not create a duplicate entry describing the same implementation.

Example:

```text
Implementation Agent:
Added Redis caching.

        ↓

Testing Agent:
Found stale-cache bug.

        ↓

Debugging Agent:
Fixed cache invalidation.

        ↓

Debugging Agent updates the existing Redis caching entry.
```

The implementation log must represent the CURRENT implementation state.

Do not leave contradictory descriptions of the same feature.

---

## 6. Testing Log Rules

The Testing Agent owns `testing-log.md`.

The testing log must record actual testing activity and results.

For each meaningful testing cycle, record concise information such as:

```markdown
### Redis Caching Tests

- Tests: Cache hit, cache miss, TTL, invalidation
- Result: PASS
- API tests: PASS
- Integration tests: PASS
- Notes: No stale-cache behavior observed.
```

When a defect is discovered:

```markdown
### Cache Invalidation

- Result: FAIL
- Problem: Statistics remained stale after crime update.
- Affected area: Cache invalidation logic.
- Status: Sent to Debugging Agent.
```

After the Debugging Agent fixes the issue, the Testing Agent updates the
testing log:

```markdown
### Cache Invalidation — Retest

- Result: PASS
- Retest: Crime update followed by statistics request.
- Status: Fixed and verified.
```

Do NOT rewrite previous testing results to make the history appear cleaner.

The testing log should preserve the important testing history while remaining
concise.

Do NOT include:

* Full terminal output
* Large stack traces
* Long debugging explanations
* Agent reasoning
* Unrelated test results

Only record information useful for understanding validation and discovered
problems.

---

## 7. Validation Requirements

The exact checks depend on the phase.

Use the appropriate combination of:

* ESLint
* TypeScript/type checking
* Unit tests
* Integration/API tests
* Production build
* Playwright MCP
* k6
* Database/query validation
* Redis validation
* Docker validation
* Nginx/load-balancing validation
* Worker/queue validation

Do not claim a check passed unless it was actually executed.

### Frontend Changes

When applicable, frontend changes should include:

```text
Lint
→ Typecheck
→ Tests
→ Build
→ Playwright
```

### Backend Changes

When applicable, backend changes should include:

```text
Lint
→ Typecheck
→ Unit/API/Integration Tests
→ Build
```

### Performance/System Design Changes

Use k6 when the phase involves:

* Load testing
* Stress testing
* Spike testing
* Endurance testing
* Rate-limit testing
* Scalability testing

Do not use Playwright for high-volume load generation.

---

## 8. Playwright MCP

Use Playwright MCP for user-facing/browser behavior when applicable.

Examples include:

* Authentication
* Crime reporting
* Map functionality
* Search/filtering
* Pagination
* Statistics
* Media/thumbnails
* API-driven UI
* Important end-to-end regression checks
* Critical user workflows after infrastructure changes

Playwright should verify actual user workflows, not simply whether a page loads.

Do not use Playwright as a replacement for k6.

Use:

```text
Playwright → Browser/user workflow validation
k6        → Load/performance testing
```

The Testing Agent should record Playwright results in `testing-log.md`.

---

## 9. Debugging Cycle

When the Testing Agent identifies a problem:

1. Testing Agent records the failure in `testing-log.md`.
2. Testing Agent clearly identifies the affected functionality and relevant
   files when known.
3. Debugging Agent investigates the root cause.
4. Debugging Agent fixes the implementation.
5. Debugging Agent runs relevant validation.
6. Debugging Agent updates the affected entry in `implementation-log.md`.
7. Testing Agent re-runs the affected tests.
8. Testing Agent records the retest result in `testing-log.md`.
9. Repeat until the issue is resolved.

The Debugging Agent must not delete or rewrite testing history.

Do not mark a bug as resolved merely because the Debugging Agent believes the
fix works.

The Testing Agent must confirm the fix.

---

## 10. Git Rules

### Implementation Agent

The Implementation Agent is responsible for committing and pushing completed
work.

Before committing:

```text
Review git status
→ Review git diff
→ Run required validation
→ Confirm no secrets/debug artifacts
→ Confirm implementation log is updated
→ Commit
→ Push
```

Commit only changes belonging to the current phase.

The Implementation Agent should review debugging changes before the final
commit.

### Testing Agent

MUST NOT:

* Commit
* Push
* Reset
* Revert
* Checkout/revert another agent's work
* Discard implementation changes

Testing changes may remain in the working tree for the Implementation Agent
to review and commit when appropriate.

### Debugging Agent

MUST NOT:

* Commit
* Push
* Reset
* Revert unrelated work
* Discard unrelated changes

Debugging changes remain in the working tree.

The Implementation Agent reviews the final changes and commits them after the
Testing Agent confirms that the issue is fixed.

---

## 11. Documentation Ownership

Use the following ownership model:

| File                    | Implementation               | Testing  | Debugging   |
| ----------------------- | ---------------------------- | -------- | ----------- |
| `plan.md`               | Read / update when necessary | Read     | Read        |
| `implementation-log.md` | **Owns**                     | Read     | **Updates** |
| `testing-log.md`        | Read                         | **Owns** | Read        |

The logs should not contain duplicate information.

Use the implementation log to answer:

> "What is currently implemented and how?"

Use the testing log to answer:

> "What was tested, what failed, and what was verified?"

---

## 12. Do Not Trust Previous Agent Claims

Agents must verify the current repository state themselves.

Do not assume that:

* A previous agent completed a feature.
* A previous test passed.
* A previous build succeeded.
* A previous agent committed all changes.
* The documentation accurately reflects the current code.

Use the repository, `git status`, `git diff`, actual test execution, and other
available validation tools as the source of truth.

Previous documentation is context, not proof.

---

## 13. Phase Completion

A phase is complete only when:

* The planned implementation is complete.
* Required tests pass.
* Relevant Playwright validation passes when applicable.
* Relevant k6/performance validation passes when applicable.
* Known defects are resolved or explicitly accepted.
* `implementation-log.md` accurately describes the final implementation.
* `testing-log.md` accurately records the final testing status.
* The Testing Agent has confirmed the final implementation passes.
* The Implementation Agent has reviewed the final diff.
* The Implementation Agent has committed and pushed the final changes.

The implementation log should describe the final implementation state.

The testing log should preserve the important testing and debugging-validation
history without becoming a detailed transcript.

````
