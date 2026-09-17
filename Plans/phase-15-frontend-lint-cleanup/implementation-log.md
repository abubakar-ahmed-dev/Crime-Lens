# Phase 15 — Frontend Lint Cleanup & CI Enforcement: Implementation Log

Branch: `feature/phase-15-lint-cleanup` · Date: 2026-09-18 · Plan: audit-driven
(live `npm run lint` baseline captured before any change; k6 final phase
renumbered 15 → 16 at planning time).

## Implemented

- **Deleted orphan `src/routes.js`** — JSX in a `.js` file caused the ESLint
  parsing error; `App.tsx` imports `./routes/index` (verified: repo-wide grep
  showed zero importers). Real routing lives in `src/routes/index.tsx`.
- **Shared types** — `src/types/api.ts` (StaffUser, StaffLoginResponse as a
  discriminated success/failure union modeled on
  `controllers/authControllers.js login`); `src/types/declarations.d.ts`
  gained the `window.searchBarRef` global (SearchBar owns the ref,
  MapClickHandler reads it — replaces two `(window as any)` casts).
- **All 65 `no-explicit-any` sites typed**, behavior-preserving:
  - AuthContext: `Session`/`CitizenUserType` for session state, axios
    `isAxiosError` narrowing for the login catch (message fallback chain
    preserved), `catch {}` where the binding was unused.
  - Records stack (`AllRecords`, `RecordsTable`, `downloadCSV`,
    `DetailsPopup`): `AllRecordsRow = Partial<CrimeRecord & AgentRecord>`
    (version decides shape), `UpdateModalData` for the update-modal form bag,
    coordinate resolver typed via `CrimeLocationSource` +
    `isValidStoredCoordinate` made a `value is number | string` predicate,
    dynamic search key access via one `Record<string, unknown>` cast.
  - `Verification.tsx`: `VerificationRecord` (admin agent-request vs police
    crime payload unions), local copy of the typed coordinate resolver.
  - `VerificationCard.tsx`: discriminated-union narrowing replaced every
    `(props as any)`; media mapper typed with `UploadedMedia`.
  - `StatsCharts.tsx`: mapper params typed per endpoint payload; recharts
    tick renderer typed (`CustomXAxisTickProps`); the one unavoidable cast is
    `pieData as unknown as Record<string, unknown>[]` (recharts v3 wants an
    indexed datum shape).
  - Catch blocks: `isAxiosError` narrowing + `instanceof Error` fallback
    chains that mirror the old `err.message || "fallback"` behavior.
  - Event handlers: `ChangeEvent<HTMLInputElement>`, `FormEvent<...>`.
- **`react-refresh/only-export-components` (4)**: `LocationPicker`'s
  `isValidLocation` + `LocationValue` moved to
  `src/components/locationValidation.ts` (5 importer files updated, no
  re-export shim so the rule stays meaningful). `AuthContext.tsx` and
  `MapContext.tsx` carry a single documented per-file disable — provider +
  hook + client co-location is the idiomatic context-module pattern and
  splitting would churn imports across every consumer for zero runtime gain.
  Rule stays enforcing everywhere else.
- **`ban-ts-comment` (6)**: all `@ts-ignore`s in `VerificationCard` removed —
  the discriminated union narrows inside the `props.version === "admin"`
  blocks, so they were never needed.
- **Unused vars (5)** / **empty-object types (2)**: dead catch bindings
  removed (`(err) =>` → `catch {`), unused `onReject` destructure dropped
  (prop kept in the interface; callers still pass it), `UploadPage: FC<{}>`
  → `FC`.
- **Type-contract discovery handled without behavior change**: the
  `'removed'` visibility sentinel that `PoliceMediaEditor` passes to parents
  on delete was previously hidden by `as any`. `MediaUpdate.visibility`
  (both the `types.tsx` and `api.ts` copies) now includes `'removed'` with a
  comment marking it UI-only; `VerificationCard`'s optimistic-change type
  mirrors it. Latent issue recorded, NOT behaviorally "fixed" here: that
  sentinel can reach the parents' saved update payloads.
- **CI flip** — `.github/workflows/ci.yml`: `continue-on-error: true`
  removed, job renamed `Lint Frontend`, debt comment replaced with the
  enforcing note. New lint errors now fail the job and the run.
- **Widened `UserType.id` to `number`** (was `string`) to match the backend
  serial id; verified zero consumers of `user.id` in the repo.

## Deliberately NOT done (per plan)

- The 13 `react-hooks/exhaustive-deps` warnings: adding dependencies would
  change when effects re-run (double-fetch / stale-closure behavior risk)
  for no CI benefit. Left visible in lint output as accepted debt.
- Backend ESLint config: no repo setup exists — out of scope.

## Validation (all actually executed)

```text
ESLint:      0 errors (baseline was 83) · 13 warnings, unchanged
TypeScript:  npx tsc -b clean
Build:       npm run build PASS (tsc -b + vite, ~41 s)
Backend:     untouched (no backend files in diff)
CI:          enforced on the PR run — see testing log
```

## Files

```
db-project-frontend/src/routes.js                                   (deleted)
db-project-frontend/src/types/api.ts                                (new)
db-project-frontend/src/components/locationValidation.ts            (new)
db-project-frontend/src/context/AuthContext.tsx                     (typed + disable comment)
db-project-frontend/src/services/api.ts                             (typed exports, 'removed' sentinel)
db-project-frontend/src/pages/MapViewPage/components/types.tsx      ('removed' sentinel)
db-project-frontend/src/pages/MapViewPage/components/{MapContext,MapClickHandler,SearchBar,ZonePolygons}.tsx
db-project-frontend/src/pages/AllRecordsPage/component/*            (AllRecords, RecordsTable, DetailsPopup, downloadCSV)
db-project-frontend/src/pages/StatisticsPage/component/StatsCharts.tsx
db-project-frontend/src/pages/VerificationPage/component/*          (Verification, VerificationCard, ConfirmationPopup)
db-project-frontend/src/pages/{AuthCallback,CitizenDashboardPage/component,ReportCrimePage/component,UploadPage,AdminControlsPage,AddPolicePage/component}/...
db-project-frontend/src/layouts/page-layouts.tsx                    (RootState selector)
db-project-frontend/src/components/{CrimeRecordForm,MediaUploader,PoliceMediaEditor,LocationPicker}.tsx
.github/workflows/ci.yml                                            (lint job enforcing)
Plans/*                                                             (renumber + this phase's docs)
```
