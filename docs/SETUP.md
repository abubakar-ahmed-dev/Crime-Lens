# Setup

This document describes the current setup flow for the CrimeLens repository.

## Project Layout

- `db-project-backend/` - Express API, Sequelize models, Supabase/PostgreSQL connection, route controllers, SQL scripts.
- `db-project-frontend/` - Vite React application.
- `docs/` - Project documentation.
- `tests/` - Present in the repository, but no verified automated test flow is documented in code.

## Prerequisites

- Node.js and npm.
- A Supabase project with PostgreSQL.
- PostGIS enabled in the database. The setup SQL enables `postgis`.
- Supabase Auth configured for citizen email/password auth. Google OAuth is supported by the code, but provider setup is done in Supabase.

Exact Node.js version is not specified in the repository.

## Backend Setup

1. Install dependencies:

```bash
cd db-project-backend
npm install
```

2. Create backend environment file:

```bash
cp .env-sample .env
```

3. Fill required values in `db-project-backend/.env`:

```env
DATABASE_URL=postgresql://postgres:<password>@<host>:5432/postgres
PORT=5001
NODE_ENV=development
CORS_ORIGINS=http://localhost:5173

JWT_SECRET=replace-with-a-long-random-secret

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

Required by `config/envValidation.js`:

- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `JWT_SECRET`

Optional:

- `SUPABASE_SERVICE_ROLE_KEY`
- `CORS_ORIGINS`
- `PORT`
- `NODE_ENV`

4. Run database setup in Supabase SQL Editor:

```sql
-- db-project-backend/scripts/supabase-setup.sql
```

5. If needed, run additional migration scripts from `db-project-backend/scripts/`.

The repository contains separate migration files for citizen auth/profile UUID, dropping legacy `CrimeSubmission` columns, and soft delete status. Only run migration files that match your current database state.

6. Start backend:

```bash
npm start
```

The backend listens on `PORT`, defaulting to `5001`.

## Frontend Setup

1. Install dependencies:

```bash
cd db-project-frontend
npm install
```

2. Create frontend environment file:

```bash
cp .env-sample .env
```

3. Fill values:

```env
VITE_API_BASE_URL=http://localhost:5001/api
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

4. Start frontend:

```bash
npm run dev
```

The Vite dev server normally runs at `http://localhost:5173`.

## Build Verification

Frontend build:

```bash
cd db-project-frontend
npm run build
```

Backend syntax checks can be run per file with Node, for example:

```bash
cd db-project-backend
node --check server.js
```

The backend package currently does not define a test script.

## Supabase Auth Notes

Citizen auth uses Supabase Auth. Citizen profile data is stored separately in `CrimeReportsSubmitter`.

Email/password registration calls Supabase `signUp`, then creates a local `CrimeReportsSubmitter` row.

Google OAuth callback handling is implemented in the frontend and then linked to a local citizen profile through `POST /api/citizens/google-auth`.

## Unknowns

- Production deployment target is not specified.
- Required Supabase redirect URLs are not fully inferable from code alone.
- Seed data for zones is not included in `supabase-setup.sql`; zones must exist for zone-based features.
