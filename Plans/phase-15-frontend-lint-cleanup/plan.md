# Phase 15: Frontend Lint Cleanup & CI Enforcement

## Objective

Eliminate the frontend's pre-existing ESLint debt so the CI `Lint Frontend`
job can be flipped from report-only (`continue-on-error: true`) to
**enforcing**. After this phase, GitHub shows a fully green CI run — no red
job annotation, no failure email — and any NEW lint error introduced by a
future change fails CI like every other check.

The user's acceptance signal for this phase is visual: the merged dev
branch's CI run shows zero failed jobs.

## Why inserted before the final k6 phase (renumbering)

The final k6 scalability phase was `phase-15`; it is now `phase-16`
(`Plans/phase-16-k6-final/`, directory renamed, internal paths updated).
Rationale: the final report's delivery matrix must list lint enforcement as
DONE, not deferred — and CI stays visually green during the final phase.

## Baseline Evidence (measured 2026-09-17, `npm run lint`)

96 problems in `db-project-frontend`: **83 errors, 13 warnings**, across
28 files.

| Rule | Count | Nature |
|------|-------|--------|
| `@typescript-eslint/no-explicit-any` | 65 | Untyped API responses, catch params, event targets, chart/leaflet payloads |
| `react-hooks/exhaustive-deps` | 13 (warnings) | Effect dependency arrays |
| `@typescript-eslint/ban-ts-comment` | 6 | `@ts-ignore` in VerificationCard |
| `@typescript-eslint/no-unused-vars` | 5 | Dead `err`/`error` params, unused `onReject` prop |
| `react-refresh/only-export-components` | 4 | AuthContext (×2), MapContext, LocationPicker |
| `no-empty-object-type` + `no-empty-pattern` | 2 | UploadPage |
| Parsing error | 1 | `src/routes.js` — JSX in a `.js` file |

### Key audit findings

1. **`src/routes.js` is an orphan.** `App.tsx` imports
   `./routes/index` (the real routing in `src/routes/index.tsx`). Nothing
   imports `routes.js`; it is also the file causing the parsing error.
   → **Delete it** (double-check with a repo-wide import grep first).
2. **`no-explicit-any` hotspots**: AuthContext (9), AllRecords +
   DetailsPopup + RecordsTable + downloadCSV (11), StatsCharts (6),
   VerificationCard (6) + Verification (2) + ConfirmationPopup (1),
   AdminControlsPage (5), CitizenDashboard (4), AuthCallback (4),
   SearchBar/Map components (6), api.ts (2), rest scattered.
3. **Warnings do not fail CI** (`eslint .` exits 0 with warnings). The 13
   `exhaustive-deps` warnings are deliberately LEFT AS-IS: mechanically
   adding dependencies to `useEffect` arrays changes when effects re-run
   (double-fetch / stale-closure behavior changes) — a real regression risk
   with zero CI benefit. They stay visible in lint output for a future
   behavioral-cleanup phase.

## Implementation Steps

### Step 1: Delete orphan `src/routes.js`

Verify no imports repo-wide, then delete. Removes the parsing error.

### Step 2: Shared API types — `src/types/`

Create typed interfaces for the backend payloads the frontend consumes
(crime records, stats shapes, auth/user shapes, verification records,
media objects, zone/type shapes). Source of truth: the actual response
shapes the code already consumes (inspect `services/api.ts` callers and
backend controllers). Existing local types are reused where present; no
invention of fields the backend does not return.

### Step 3: Type the 65 `any` sites (grouped by page, behavior-preserving)

Rules for every fix, in priority order:

1. Real interface/type (from `src/types/`) — preferred.
2. Correct DOM/Leaflet/Recharts library types
   (`ChangeEvent<HTMLInputElement>`, `LeafletMouseEvent`, tooltip payload
   types).
3. `unknown` + runtime narrowing (catch params: prefer
   `axios.isAxiosError` / message extraction that mirrors the existing
   `err.message` usage exactly).
4. NO blanket `eslint-disable`, NO `any` aliases, NO type assertions that
   silence a genuinely wrong assumption.

Constraints:

- Runtime behavior byte-identical: no changes to JSX output, API calls,
  control flow, or null-handling. Where typing reveals a latent
  null-safety issue, preserve current behavior (add the type that matches
  reality, e.g. optional field) and note it in the implementation log
  rather than "fixing" behavior inside a lint phase.
- `tsc -b` (part of `npm run build`) must stay green — it is the stronger
  check.
- `@ts-ignore` ×6 in VerificationCard: replace with real types where
  feasible; only where third-party typings are genuinely broken, use
  `@ts-expect-error` with a one-line reason.

### Step 4: Unused vars (5) + UploadPage empty-object types (2)

- Remove dead `err`/`error` catch params (`(err) =>` → `() =>` where the
  param is unused) and the unused `onReject` prop from the destructure
  (keep the prop in the component's interface if callers pass it).
- UploadPage `{}` type → proper record/props interface; `{} destructure`
  → real props type.

### Step 5: react-refresh violations (4)

- **LocationPicker.tsx** — move the exported non-component (constant/
  helper) to a sibling module and import it back. No disable comment.
- **AuthContext.tsx (×2), MapContext.tsx** — provider + hook + context in
  one file is the idiomatic React context pattern; splitting would churn
  imports across every consumer (15+ files) for zero runtime benefit
  (fast-refresh limitation only). Add a single documented per-file
  `eslint-disable react-refresh/only-export-components` with the reason.
  Rule stays fully enforcing everywhere else — new violations still fail CI.

### Step 6: Flip CI to enforcing — `.github/workflows/ci.yml`

- Remove `continue-on-error: true` from the lint job.
- Rename job `Lint Frontend (report-only — pre-existing debt)` →
  `Lint Frontend`.
- Replace the debt-explaining comment with a note that debt was cleared in
  phase 15 and the job is enforcing.

### Step 7: Validation

```text
npm run lint          → 0 errors (warnings ≤ 13, unchanged)
npm run build         → tsc -b + vite build PASS
Backend untouched     → no backend changes in this phase
git diff review       → only frontend + ci.yml + Plans files
```

### Step 8: Playwright MCP regression (REQUIRED — AuthContext + many components touched)

Full user-workflow smoke over the running stack:

- Auth: citizen login → authenticated UI; admin login → admin UI
  (dual auth system: JWT admin/police + Supabase citizen — both exercised)
- Map: render, markers load, zone polygons, filter/search interaction
- Report crime: open form, fill, submit, success state
- Statistics: dashboard + charts render with data
- Verification (admin/police): list loads, detail popup opens
- All records (admin): table renders, pagination
- Citizen dashboard: reports list renders
- Media: thumbnails render where present (records/verification detail)

Any regression: stop, fix, re-run lint/build/tests, re-run Playwright.

### Step 9: Push branch → observe CI run green (the user's acceptance criterion)

The PR's own CI run is the evidence: every job green, lint job enforcing.

## Out of Scope

- The 13 `exhaustive-deps` warnings (behavioral cleanup — separate future
  phase; documented as accepted debt)
- Backend ESLint config (backend has no lint setup — separate phase if
  wanted)
- Any behavior change, feature work, or dependency upgrades
- `phase-16` k6 work (separate next phase)

## Success Criteria

- [ ] `npm run lint` exits 0 with **0 errors** (13 known warnings remain,
      unchanged in count)
- [ ] `npm run build` passes (tsc + vite)
- [ ] CI lint job enforcing (no `continue-on-error`) and GREEN on the PR
      run; whole run shows zero failed jobs
- [ ] Playwright regression: all workflows above PASS, no user-visible
      behavior change
- [ ] No `eslint-disable` except the 3 documented per-file context-module
      comments; zero `any` in `src/`
- [ ] `git diff` limited to `db-project-frontend/src/**`,
      `.github/workflows/ci.yml`, `Plans/**`

## Files (expected)

```
src/routes.js                                              (deleted)
src/types/*.ts                                             (new)
~24 existing .tsx/.ts files                                (type fixes)
src/components/locationPickerConstants.ts (or sibling)     (new, small)
.github/workflows/ci.yml                                   (flip + rename)
Plans/phase-15-frontend-lint-cleanup/{implementation,testing}-log.md (new)
Plans/phase-16-k6-final/  (renamed from phase-15, paths updated — done at planning)
```

## Rollback

Single `git revert` of the phase commit restores everything; no data,
schema, or backend involvement.

## Estimated Completion Time

- Types + 65 any-site fixes: 3 h
- Structural fixes + CI flip: 0.5 h
- Playwright regression: 1 h
- Logs + CI verification: 0.5 h
- **Total: ~5 h**
