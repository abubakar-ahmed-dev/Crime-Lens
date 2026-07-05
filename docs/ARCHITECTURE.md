# Architecture

CrimeLens is a full-stack web application for public crime visibility, citizen crime reporting, and police/admin record management.

## High-Level System

```text
React frontend
  -> Express API
    -> Sequelize models and raw SQL
      -> Supabase PostgreSQL + PostGIS
  -> Supabase Auth client for citizen auth flows
```

## Frontend

Location:

```text
db-project-frontend/
```

Main technologies:

- React
- TypeScript
- Vite
- Redux Toolkit for role state
- React Router
- Supabase client
- Leaflet / React Leaflet for maps
- Recharts for statistics
- Tailwind utility classes
- Lucide icons

Important files:

- `src/App.tsx` - route composition and route guards.
- `src/routes/index.tsx` - public, citizen-protected, and staff-protected route lists.
- `src/layouts/page-layouts.tsx` - shared layout, sidebar, mobile menu behavior.
- `src/context/AuthContext.tsx` - staff and citizen auth flows.
- `src/config/constants.js` - API base URL.
- `src/store/features/current_role.tsx` - current role state and localStorage synchronization.

## Backend

Location:

```text
db-project-backend/
```

Main technologies:

- Express
- Sequelize
- PostgreSQL/Supabase
- PostGIS
- Supabase Auth SDK
- JWT
- bcrypt/bcryptjs
- multer
- fast-csv

Important files:

- `server.js` - Express startup and route mounting.
- `models/index.js` - Sequelize initialization and model associations.
- `middleware/authMiddleware.js` - JWT/staff auth and Supabase citizen auth.
- `config/envValidation.js` - required environment validation.
- `config/supabase.js` - Supabase client setup.
- `config/multerConfig.js` - CSV upload file filter and size limit.

## Backend Route Modules

- `authRoutes.js` - staff login.
- `citizenAuthRoutes.js` - citizen registration, login, profile, report tracking.
- `userRoutes.js` - citizen report submission and police report verification.
- `crimeRoutes.js` - public map crimes, crime types, police crime records.
- `agentRoutes.js` - agent requests, approval, records.
- `adminRoutes.js` - CSV upload, branch controls, direct police agent creation.
- `statsRoutes.js` - public statistics.
- `zoneRoutes.js` - public zones, severity, boundary checks.

## Main Workflows

### Public Map And Statistics

1. User opens `/map` or `/statistics`.
2. Frontend calls public API routes.
3. Backend queries approved crimes only for map/statistics.
4. Results are rendered without requiring auth.

### Citizen Registration And Reporting

1. Citizen registers through Supabase Auth via backend citizen route.
2. Backend creates `CrimeReportsSubmitter`.
3. Citizen verifies email when required by Supabase.
4. Citizen completes profile with CNIC/contact/address.
5. Citizen submits report through `POST /api/user/report-crime`.
6. Backend creates `Crime` with `pending` status.
7. Backend creates `CrimeSubmission` linking the citizen submitter to the crime.

### Police Verification

1. Police logs in through staff login.
2. Police opens verification page.
3. Frontend calls `GET /api/user/pending`.
4. Police approves or rejects a pending submission.
5. On approval, backend validates location against selected zone boundary.
6. Backend sets crime status to `approved` and stores `latestUpdatedBy`.
7. On rejection, backend sets crime status to `rejected`.

### Police Crime Record Management

1. Police opens crime records.
2. Frontend calls police-only crime endpoints.
3. Police can update approved crime details.
4. Location updates are validated against the selected zone boundary.
5. Delete performs a soft delete by setting status to `deleted`.

### Admin Agent And Branch Management

1. Admin logs in through staff login.
2. Admin can review agent requests and approve/reject them.
3. Admin can create branches.
4. Admin can directly create police agents.
5. Admin can assign or clear branch heads.

### CSV Import

1. Admin uploads a CSV file.
2. Backend parses and validates rows.
3. Backend deduplicates against existing crimes and within the CSV.
4. Backend inserts valid non-duplicate rows.
5. Backend writes an `UploadLog`.

## Data Access Pattern

The backend uses a mixture of:

- Sequelize model methods.
- Raw SQL through `sequelize.query`.

Raw SQL is common in controllers where joins, PostGIS functions, or custom views are needed.

## Frontend State Pattern

Auth and role state are split:

- `AuthContext` manages actual login/session data.
- Redux `current_role` controls role-dependent UI state.
- localStorage persists role/auth mode across refreshes.

## Unknowns

- The repository does not define a production deployment architecture.
- There is no documented background worker or scheduled job.
- There is no current event bus or queue.
