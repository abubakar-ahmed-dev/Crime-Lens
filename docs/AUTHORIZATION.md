# Authorization

CrimeLens has three active access categories:

- Public users
- Citizens
- Staff users: admin and police

## Public Access

Public users do not need a token.

Current public backend endpoints include:

- `GET /api/crimes`
- `GET /api/crimes/types`
- `GET /api/stats/summary`
- `GET /api/stats/crime-type-distribution`
- `GET /api/stats/zone-crime-count`
- `GET /api/stats/crime-trend`
- `GET /api/zones`
- `GET /api/zones/severity`
- `POST /api/zones/:id/contains`
- `POST /api/agent/request`
- citizen registration/login endpoints

Public frontend routes include:

- `/`
- `/login`
- `/login-admin`
- `/login-citizen`
- `/register`
- `/request-agent`
- `/dashboard`
- `/statistics`
- `/map`
- `/meet-developers`
- `/auth/callback`

## Citizen Authentication

Citizens authenticate through Supabase Auth.

Protected citizen API routes use `authorizeCitizen`, which:

1. Reads `Authorization: Bearer <token>`.
2. Calls `supabase.auth.getUser(token)`.
3. Rejects missing, invalid, or expired tokens.
4. Rejects unverified email/password users when `email_confirmed_at` is missing.
5. Attaches a citizen-shaped `req.user`.

Protected citizen endpoints:

- `GET /api/citizens/profile`
- `PUT /api/citizens/profile`
- `PUT /api/citizens/update-profile`
- `GET /api/citizens/my-reports`
- `POST /api/user/report-crime`

Citizen-only frontend routes:

- `/complete-profile`
- `/citizen-dashboard`
- `/report-crime`

Current report submission rule:

- Citizen must be logged in.
- Citizen profile must be complete.
- Anonymous reporting is not allowed.

## Staff Authentication

Admin and police users authenticate through `POST /api/auth/login`.

The backend:

1. Looks up `User` by username.
2. Reads role through `Role`.
3. Checks the password with bcrypt when stored as hash.
4. If a matching stored password is plain text, it hashes and updates it.
5. Verifies selected login role against actual role.
6. Issues a JWT valid for 6 hours.

Staff protected routes use:

- `verifyToken`
- `authorizeRoles(...)`

JWT payload contains:

- `id`
- `username`
- `role`

## Admin Permissions

Admin-only backend endpoints:

- `POST /api/admin/upload-crimes`
- `GET /api/admin/branches`
- `POST /api/admin/branches`
- `PUT /api/admin/branches/:branchId/head`
- `GET /api/admin/police-agents`
- `POST /api/admin/police-agents`
- `GET /api/agent/all`
- `PUT /api/agent/update/:id`
- `DELETE /api/agent/delete/:id`
- `GET /api/agent/pending`
- `POST /api/agent/verify/:requestId`
- `POST /api/agent/reject/:requestId`

Admin-only frontend features:

- CSV upload
- Agent records
- Agent verification
- Admin controls
- Branch creation
- Branch head assignment
- Direct police agent creation

## Police Permissions

Police-only backend endpoints:

- `GET /api/user/pending`
- `POST /api/user/approve/:submissionId`
- `POST /api/user/reject/:submissionId`
- `GET /api/crimes/all`
- `GET /api/crimes/get-crime/:id`
- `PUT /api/crimes/update/:id`
- `DELETE /api/crimes/delete/:id`

Police-only frontend features:

- Crime verification
- Crime records
- Crime update
- Crime soft delete

## Frontend Route Guards

Frontend route guarding is implemented in `App.tsx`.

Staff protected routes use `ProtectedRoute`, which checks:

- `authMode === "staff"`
- `token` exists
- `staffRole` is included in route `allowedRoles`

Citizen routes use `CitizenProtectedRoute`, which checks:

- `authMode === "citizen"`
- `citizen` exists
- `citizen_token` exists

The sidebar/menu is role-aware. Public dashboard/statistics views initialize a public user role for navigation display, but this does not grant backend staff permissions.

## Role Storage In Browser

The frontend uses local storage keys including:

- `authMode`
- `token`
- `user`
- `staffRole`
- `userRole`
- `citizen`
- `citizen_token`
- `citizen_session`

Staff and citizen logout paths clear separate auth state.

## Important Current Rules

- CSV upload is admin-only.
- Agent records are admin-only.
- Crime verification is police-only.
- Crime records are police-only.
- Citizen reporting requires a logged-in citizen with a complete profile.
- Public map/statistics data is available without login and is also reachable by logged-in roles.
- Police approval/update requires the chosen location to be inside the selected zone boundary.

## Unknowns

- The repository does not define a separate unauthorized page.
- Fine-grained permissions inside a role are not implemented beyond route-level role checks.
