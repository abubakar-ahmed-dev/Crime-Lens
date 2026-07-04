# Required Fixes

This file lists repository fixes identified from the current code, configuration, schema, and project structure. Use it as a working checklist and update items as they are corrected.

## Security And Authorization

- [x] Add backend authentication middleware to `POST /api/admin/upload-crimes`.
- [x] Restrict agent administration endpoints to admin users:
  - `GET /api/agent/all`
  - `PUT /api/agent/update/:id`
  - `DELETE /api/agent/delete/:id`
  - `POST /api/agent/verify/:requestId`
  - `POST /api/agent/reject/:requestId`
  - `GET /api/agent/pending`
- [x] Restrict crime verification endpoints to police users:
  - `GET /api/user/pending`
  - `POST /api/user/approve/:submissionId`
  - `POST /api/user/reject/:submissionId`
- [x] Protect `POST /api/user/report-crime` with citizen authentication; anonymous reporting is disabled.
- [x] Restrict crime record mutation endpoints to police users:
  - `PUT /api/crimes/update/:id`
  - `DELETE /api/crimes/delete/:id`
- [x] Decide whether public read endpoints such as `/api/crimes/all` and `/api/agent/all` should remain public or require authorization. `/api/crimes/all` is police-only; `/api/agent/all` is admin-only; map/statistics endpoints remain public.
- [x] Ensure frontend route protection matches backend authorization rules. Backend authorization must be the source of truth.

## Authentication

- [x] Fix or remove `loginUser` in `src/services/api.js`; it calls `/auth/login` without the required `verify_role`.
- [x] Standardize admin/police auth state storage. Current code stores token, user, and role through multiple paths.
- [x] Ensure logout clears all relevant admin/police auth state, including `token`, `user`, and `userRole`.
- [x] Review citizen auth route protection on the frontend. Some citizen routes are listed as public in `src/routes/index.tsx`.
- [x] Remove hard-coded Supabase URL and anon key fallbacks from frontend code if environment-only configuration is required.

## Backend Bugs

- [x] Fix transaction scope issues in `CrimeControllers.js`; catch blocks reference `t` where it may be out of scope.
- [x] Fix `approveCrimeReport` and `rejectCrimeReport` transaction handling so all early returns rollback or commit consistently.
- [x] Fix `agentController.rejectAgentRequest`:
  - It commits before later update/delete queries.
  - It references `reason` even though `reason` is commented out and undefined.
  - It uses a transaction after it has already been committed.
- [x] Fix `agentController.deleteAgent`; the catch block commits instead of rolling back.
- [x] Review `agentController.agentRequest`; early validation failures after opening a transaction should rollback before returning.
- [x] Review all raw SQL updates that interpolate latitude/longitude directly into SQL and replace with safe query parameters where possible.
- [x] Fix direct SQL interpolation in `zoneController.getZoneSeverity` for `crimeType`, `zoneId`, `startDate`, and `endDate`.
- [x] Remove sensitive debug logging from auth flow, especially plaintext password and password hash logs.
- [x] Ensure password fields are never returned to frontend responses, especially pending agent request data.

## Database And Schema

- [ ] Reconcile `DB Project Schema-DDL.sql`, `scripts/supabase-setup.sql`, Sequelize models, and actual runtime queries.
- [ ] Add or document definitions for required database views:
  - `view_PendingSubmissions`
  - `view_all_crimes`
  - `viewAllAgents`
- [x] Validate `User.id` type consistency across SQL scripts, Sequelize models, and foreign keys.
- [x] Validate `PoliceAgentRequest.userId` type consistency across SQL scripts, Sequelize models, and inserts.
- [x] Validate `CrimeReportsSubmitter` schema compatibility with both legacy anonymous submitter fields and current citizen profile fields.
- [x] Confirm whether `CrimeSubmission.userId` should reference `CrimeReportsSubmitter.submitterCnic`, Supabase user ID, or another stable citizen identifier.
- [x] Ensure `CrimeSubmission.CrimeId` nullability and foreign key behavior are consistent. It remains `NOT NULL` and uses `ON DELETE RESTRICT`.
- [x] Decide whether `activitylog` is required. It exists in setup SQL but has no model/controller usage.
- [ ] Remove duplicate or conflicting index/type declarations from schema files.

## Environment And Configuration

- [ ] Update backend environment validation to include `DATABASE_URL`, because `config/db.js` uses it.
- [ ] Remove unused required DB variables from `envValidation.js` or update `config/db.js` to use them consistently:
  - `DB_NAME`
  - `DB_USER`
  - `DB_PASS`
  - `DB_HOST`
  - `DB_PORT`
  - `DB_DIALECT`
- [ ] Document required `.env` variables for backend and frontend.
- [ ] Review CORS configuration. It currently allows only `http://localhost:5173`.
- [ ] Decide production API/frontend URLs and document them.

## API Consistency

- [ ] Standardize success response formats. Some endpoints return `{ success, data }`; others spread data at the root.
- [ ] Standardize error response formats. Some controllers return `message`, others return `error`.
- [ ] Align frontend parsing with backend response shapes for citizen auth/profile/report endpoints.
- [ ] Add request validation for all mutation endpoints.
- [ ] Add consistent status codes for validation, auth, not found, conflict, and server errors.
- [ ] Document all request/response shapes after behavior is finalized.

## Frontend Issues

- [ ] Replace hard-coded crime type and zone option lists in report form with API-loaded data, or document why they are fixed.
- [ ] Fix citizen dashboard API calls that use `import.meta.env.VITE_API_BASE_URL` directly without fallback, unlike shared config.
- [ ] Confirm `/complete-profile` and `/citizen-dashboard` should be public route entries; protect them consistently.
- [ ] Fix sidebar logout behavior to clear role/user state and support citizen logout separately if needed.
- [ ] Review route visibility and sidebar menus for each role.
- [ ] Remove or implement unused `/feedback` route from sidebar.
- [ ] Ensure protected route logic checks role, not only token presence.

## Data Import

- [ ] Confirm CSV required columns and document them.
- [ ] Decide whether upload should insert only approved records or allow pending/rejected statuses from CSV.
- [ ] Ensure CSV upload is admin-only.
- [ ] Add validation/reporting for invalid rows with reasons, not only counts.
- [ ] Review 1 MB upload limit and document or adjust it.

## Testing And Quality

- [ ] Add automated backend tests for auth, authorization, crime reporting, verification, and agent approval.
- [ ] Add tests for citizen registration/login/profile completion using mocked Supabase where appropriate.
- [ ] Add tests for CSV parsing and duplicate detection.
- [ ] Add frontend route/auth behavior tests if the project intends to maintain role-based UI flows.
- [ ] Add lint/build verification instructions.
- [ ] Remove checked-in TypeScript build info files if they are generated artifacts and should not be versioned.

## Documentation Needed After Fixes

- [ ] `docs/SETUP.md`
- [ ] `docs/API.md`
- [ ] `docs/DATABASE.md`
- [ ] `docs/AUTHORIZATION.md`
- [ ] `docs/ARCHITECTURE.md`
- [ ] `docs/CSV_UPLOAD.md`
- [ ] `docs/FRONTEND_ROUTES.md`
- [ ] `docs/KNOWN_ISSUES.md`
