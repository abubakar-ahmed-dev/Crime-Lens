# Known Issues

This document lists current known gaps or uncertain areas visible from the repository.

## Build Warnings

`npm run build` in `db-project-frontend` currently passes, but Vite reports:

- CSS `@import` order warning for the Outfit font import.
- Large JavaScript chunk warning after minification.

These are warnings, not build failures.

## No Automated Test Suite Documented

The backend `package.json` does not define a test script.

The frontend has build and lint scripts, but no test script is defined in `package.json`.

## Setup SQL And Views

View SQL files exist in:

```text
db-project-backend/models/views/
```

The main setup SQL does not currently create those views. If a fresh database needs these views, they must be run separately or added to setup SQL.

## `activitylog`

The setup SQL creates `activitylog`, and the latest schema includes it.

Current code does not define:

- a Sequelize model for `activitylog`
- triggers that populate `activitylog`
- controllers that read/write `activitylog`

So the table exists as schema support, but automated activity logging is not currently implemented in code.

## UploadLog Enum Difference

`UploadLog.js` model allows:

- `completed`
- `failed`

`supabase-setup.sql` enum includes:

- `completed`
- `failed`
- `uploaded`

Current upload controller writes `completed` and `failed`.

## Zone Seed Data

The setup SQL creates `Zone` but does not seed zone records or boundaries.

Map, statistics, branch creation, and zone-boundary validation depend on valid zone data.

## Generated Build Info Files

The frontend directory contains TypeScript build info files:

- `tsconfig.app.tsbuildinfo`
- `tsconfig.node.tsbuildinfo`

Whether these should remain versioned is a repository decision not determined by code.

## Legacy Route Helper

`db-project-frontend/src/routes.js` exists and exports a `ProtectedRoute`, but the active router imports `src/routes/index.tsx` and defines guards in `App.tsx`.

The file appears unused from current imports.

## Deployment Unknowns

The repository does not specify:

- production hosting platform
- production domain
- production Supabase redirect URLs
- CI/CD workflow
- backup/restore procedure

## Not Listed As Current Issues

This file intentionally does not list older fixed defects. It describes only current code-observable gaps and unknowns.
