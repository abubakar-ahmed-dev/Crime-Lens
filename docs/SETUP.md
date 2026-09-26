# Setup

Two supported paths: **Docker** (recommended — full production shape) or
**manual** local development.

## Project Layout

- `docker-compose.yml` + `Dockerfile.backend` / `Dockerfile.frontend` - the containerized stack (nginx edge, API replicas, worker, Redis, Prometheus, Grafana).
- `db-project-backend/` - Express API, Sequelize models, Supabase/PostgreSQL connection, route controllers, SQL scripts.
- `db-project-frontend/` - Vite React application.
- `infra/` - Prometheus scrape config and Grafana provisioning.
- `docs/` - Project documentation.
- `db-project-backend/tests/k6/` - load-testing suites (see the backend README).

## Quickstart (Docker)

```bash
cp db-project-backend/.env-sample db-project-backend/.env   # then fill in real values
docker compose up -d --build
curl http://localhost/api/health                            # {"status":"healthy"}
```

Committed ports: app :80, API :5001, Prometheus :9090, Grafana :3000.
A local (gitignored) `docker-compose.override.yml` may remap them — on this
repo's dev machine it maps edge :18000, replicas :15001-15003, Prometheus
:19090, Grafana :13300; with that file present, invoke compose with both
`-f` flags and use the remapped ports.

## Prerequisites

- Docker Desktop (Docker path), or Node.js 22 + npm (manual path).
- A Supabase project with PostgreSQL and PostGIS (the setup SQL enables `postgis`).
- Supabase Auth configured for citizen email/password auth. Google OAuth is supported by the code, but provider setup is done in Supabase.
- A Cloudinary account for media storage.

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

## Load-Testing Credentials

The k6 suites read credentials from environment (never hardcode/commit them):

```bash
# db-project-backend/tests/k6/.k6.env (gitignored)
API_BASE_URL=http://localhost:18000
ADMIN_USERNAME=...
ADMIN_PASSWORD=...
CITIZEN_EMAIL=...
CITIZEN_PASSWORD=...
```

## Unknowns

- A hosted deployment target does not exist yet — images are published to
  GHCR by CI and are ready to pull when a host exists (see DEPLOYMENT.md).
- Required Supabase redirect URLs are not fully inferable from code alone.
- Seed data for zones is not included in `supabase-setup.sql`; zones must exist for zone-based features.
