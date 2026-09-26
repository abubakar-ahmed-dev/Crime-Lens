# CrimeLens Frontend

React 19 + TypeScript + Vite SPA for CrimeLens: interactive crime map
(Leaflet + marker clustering), statistics dashboards (Recharts), citizen
reporting, police verification, and admin controls.

## Scripts

```bash
npm run dev      # Vite dev server (HMR)
npm run build    # tsc -b + production build (dist/)
npm run lint     # ESLint — enforcing in CI (0 errors)
npm run preview  # serve the production build locally
```

## Environment

Vite bakes `VITE_*` variables at build time (public-by-design — nothing
secret belongs here). Copy `.env-sample` to `.env`:

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Backend API base URL |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Citizen auth (Supabase JS client) |

The production image (`Dockerfile.frontend` at the repo root) builds with
`.env.production` when present.

## Structure

```
src/
├── components/        # shared UI (LocationPicker, media, forms, buttons)
├── context/           # AuthContext — dual auth: staff JWT + citizen Supabase session
├── layouts/           # page shells (sidebar/header)
├── pages/             # route pages: MapView, Statistics, ReportCrime,
│                      #   Verification, AllRecords, CitizenDashboard, AuthCallback, ...
├── routes/            # route table + role guards
├── services/          # api.ts — axios instance + media API
├── store/             # Redux Toolkit (role state)
├── types/             # shared API payload types
└── utils/             # auth headers, thumbnails, zone helpers
```

## Conventions

- ESLint is **enforcing** in CI (`eslint .` must exit 0); the only allowed
  suppressions are two documented per-file context-module exceptions.
- Shared API payload types live in `src/types/` and
  `src/pages/MapViewPage/components/types.tsx` — type new endpoints instead
  of reaching for `any`.
- Backend contract changes are frontend changes: update both in the same
  scoped task (see `../docs/API.md`).

Docs: [`docs/`](../docs/) — architecture, API reference, operations.
