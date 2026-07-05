# Frontend Routes

Frontend routes are defined in:

```text
db-project-frontend/src/routes/index.tsx
```

Route guards are applied in:

```text
db-project-frontend/src/App.tsx
```

The shared layout and sidebar behavior are implemented in:

```text
db-project-frontend/src/layouts/page-layouts.tsx
```

## Public Routes

These routes are listed under `PublicRoutes`.

| Route | Page | Notes |
|---|---|---|
| `/` | Home | Public homepage. |
| `/login` | LoginPage | Entry point for choosing/admin-police login flow. |
| `/login-admin` | LoginAdminPolicePage | Staff login UI. |
| `/login-citizen` | CitizenLoginPage | Citizen login UI. |
| `/register` | RegisterPage | Citizen registration UI. |
| `/request-agent` | AddPolicePage | Public police agent request form. |
| `/dashboard` | DashboardPage | Public dashboard view. |
| `/statistics` | StatisticsPage | Public statistics view. |
| `/map` | MapViewPage | Public full-screen map view. |
| `/meet-developers` | MeetDevelopersPage | Public developers page. |
| `/auth/callback` | AuthCallbackPage | Supabase OAuth/email callback handling. |

## Citizen-Protected Routes

These routes require citizen auth and are wrapped in `CitizenProtectedRoute`.

| Route | Page | Notes |
|---|---|---|
| `/complete-profile` | CompleteProfilePage | Citizen profile completion. |
| `/citizen-dashboard` | CitizenDashboardPage | Citizen report tracking/profile management. |
| `/report-crime` | ReportCrimePage | Citizen crime report submission. |

Citizen route guard checks:

- `authMode === "citizen"`
- `citizen` exists in localStorage
- `citizen_token` exists in localStorage

## Staff-Protected Routes

These routes require staff auth and allowed roles.

| Route | Page | Allowed roles |
|---|---|---|
| `/all-records` | AllRecordsPage | `admin`, `police` |
| `/verification` | VerificationPage | `admin`, `police` |
| `/upload-crimes` | UploadPage | `admin` |
| `/admin-controls` | AdminControlsPage | `admin` |

Staff route guard checks:

- `authMode === "staff"`
- `token` exists
- `staffRole` is included in route `allowedRoles`

## Role-Based Behavior Inside Shared Routes

Some route paths are shared by admin and police but render different content based on role:

- `/verification`
  - admin: verifies police agent requests
  - police: verifies crime reports

- `/all-records`
  - admin: agent records
  - police: crime records

## Sidebar Behavior

Sidebar menu items are filtered by role:

Admin:

- Dashboard
- Verify Agent
- Agent Records
- Upload Data
- Admin Controls

Police:

- Dashboard
- Verify Report
- Crime Records

Citizen/public user:

- Dashboard
- Report Crime
- Profile

`/map`, auth pages, register, request-agent, complete-profile, and home hide the sidebar.

Public `/dashboard` and `/statistics` initialize a public user role when no staff/citizen session exists so the sidebar can render.

## Mobile Behavior

`PageLayout` provides a mobile header and hamburger menu when sidebar navigation is visible.

The map page has its own full-screen layout and does not use the sidebar.

## Unknowns

- There is no dedicated unauthorized page in the current route list.
- The legacy `src/routes.js` file exists but is not imported by `App.tsx`.
