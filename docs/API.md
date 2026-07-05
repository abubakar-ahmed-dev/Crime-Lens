# API

Base URL in local development:

```text
http://localhost:5001/api
```

The backend is an Express application. Routes are mounted in `server.js`.

## Authentication Conventions

Staff users use backend JWT:

```http
Authorization: Bearer <jwt>
```

Citizens use Supabase access tokens:

```http
Authorization: Bearer <supabase_access_token>
```

Common response fields include `success`, `message`, `data`, and sometimes `error`.

## Staff Authentication

### `POST /auth/login`

Logs in admin or police users stored in the `User` table.

Body:

```json
{
  "username": "admin",
  "password": "password",
  "verify_role": "Administrator"
}
```

`verify_role` accepts the current frontend role labels or role names:

- `Administrator` or `admin`
- `Police Agent` or `police`

Returns a JWT and user object on success.

## Citizen Authentication

### `POST /citizens/register`

Registers a citizen in Supabase Auth and creates a local `CrimeReportsSubmitter` profile.

Body:

```json
{
  "email": "citizen@example.com",
  "password": "secret123",
  "fullName": "Citizen Name",
  "redirectTo": "http://localhost:5173/auth/callback"
}
```

Validation:

- `email`, `password`, and `fullName` are required.
- Password must be at least 6 characters.
- Email must be unique in `CrimeReportsSubmitter`.

### `POST /citizens/login`

Logs in an existing citizen through Supabase Auth.

Body:

```json
{
  "email": "citizen@example.com",
  "password": "secret123"
}
```

Returns citizen profile data and Supabase session data.

### `POST /citizens/google-auth`

Links or creates a local citizen profile after Supabase Google OAuth.

Body:

```json
{
  "accessToken": "<supabase_access_token>",
  "mode": "login"
}
```

`mode` may be `login` or `signup`.

Current behavior:

- In `login` mode, a local citizen profile must already exist.
- In `signup` mode, a missing local profile is created.
- If configured, `SUPABASE_SERVICE_ROLE_KEY` is used to remove unregistered Google auth users during failed login attempts.

### `GET /citizens/profile`

Protected citizen route. Returns the current citizen profile.

### `PUT /citizens/profile`

Protected citizen route. Completes the citizen profile.

Body:

```json
{
  "cnic": "12345-1234567-1",
  "contact": "+923001234567",
  "address": "Address"
}
```

CNIC format must match `XXXXX-XXXXXXX-X`.

Profile is complete when CNIC, contact, and address exist.

### `PUT /citizens/update-profile`

Protected citizen route. Updates existing profile information.

Body:

```json
{
  "fullName": "Updated Name",
  "contact": "+923001234567",
  "address": "Updated address"
}
```

### `GET /citizens/my-reports`

Protected citizen route. Returns reports submitted by the current citizen.

The response includes crime title, description, dates, status, crime type name, zone name, and submission time.

## Crime Reporting And Verification

### `POST /user/report-crime`

Protected citizen route. Creates a pending `Crime` and linked `CrimeSubmission`.

Body:

```json
{
  "title": "Incident title",
  "description": "Incident details",
  "crimeTypeId": 1,
  "date": "2026-07-05",
  "address": "Incident address",
  "zone": 1,
  "latitude": 24.899983520748542,
  "longitude": 67.05814361572267
}
```

Current requirements:

- Citizen must be authenticated.
- Citizen profile must be complete.
- `date` and `crimeTypeId` are required.
- Latitude and longitude are required and must be valid numbers.
- Coordinates must be within latitude 23-26 and longitude 65-68.
- Zone boundary validation is not applied at citizen submission time.

### `GET /user/pending`

Police-only route. Returns pending crime submissions.

### `POST /user/approve/:submissionId`

Police-only route. Approves a pending report and updates the associated crime.

Body:

```json
{
  "title": "Verified title",
  "description": "Verified details",
  "address": "Verified address",
  "zoneId": 1,
  "latitude": 24.9,
  "longitude": 67.05,
  "crimeTypeId": 1,
  "incidentDate": "2026-07-05"
}
```

Current behavior:

- The submission must exist.
- The linked crime must exist and have `pending` status.
- Coordinates are required.
- The selected location must be inside the selected zone boundary.
- The approving police user's `id` is stored in `Crime.latestUpdatedBy`.
- Crime status becomes `approved`.

### `POST /user/reject/:submissionId`

Police-only route. Rejects a pending report by setting the linked crime status to `rejected`.

## Crimes

### `GET /crimes`

Public route. Returns approved crimes for the map.

Query parameters:

- `mode=basic`
- `crimeType`
- `zoneId`
- `startDate`
- `endDate`
- `mode=radius`
- `lat`
- `lng`
- `radius`

### `GET /crimes/types`

Public route. Returns all crime types.

### `GET /crimes/all`

Police-only route. Returns approved crime records.

### `GET /crimes/get-crime/:id`

Police-only route. Returns one approved crime by ID.

### `PUT /crimes/update/:id`

Police-only route. Updates an approved crime.

Body fields include:

- `title`
- `description`
- `zoneId`
- `latitude`
- `longitude`
- `crimeTypeId`
- `incidentDate`
- `address`

The updated location must be inside the selected zone boundary.

### `DELETE /crimes/delete/:id`

Police-only route. Soft deletes a crime by setting `Crime.status` to `deleted`.

## Agent Requests And Agent Records

### `POST /agent/request`

Public route. Creates a police agent request.

Body fields used by the controller:

- `username`
- `password`
- `branchId`

### `GET /agent/pending`

Admin-only route. Returns pending agent requests.

### `POST /agent/verify/:requestId`

Admin-only route. Approves an agent request and creates a `User` with police role.

### `POST /agent/reject/:requestId`

Admin-only route. Rejects an agent request.

### `GET /agent/all`

Admin-only route. Returns approved agent records.

### `PUT /agent/update/:id`

Admin-only route. Updates an agent.

### `DELETE /agent/delete/:id`

Admin-only route. Deletes/removes an agent record according to the current controller implementation.

## Admin Controls

### `GET /admin/branches`

Admin-only route. Returns police branches with zone and head information.

### `POST /admin/branches`

Admin-only route. Creates a police branch.

Body:

```json
{
  "name": "Branch name",
  "zoneId": 1,
  "address": "Branch address",
  "contactNumber": "+923001234567",
  "latitude": 24.9,
  "longitude": 67.05
}
```

### `PUT /admin/branches/:branchId/head`

Admin-only route. Assigns, replaces, or clears a branch head.

Body:

```json
{
  "userId": 12
}
```

When clearing the head, the frontend sends an empty/null value.

### `GET /admin/police-agents`

Admin-only route. Returns approved police agents.

### `POST /admin/police-agents`

Admin-only route. Directly creates a police agent in `User` and creates an approved `PoliceAgentRequest`.

Body:

```json
{
  "username": "agent1",
  "password": "secret123",
  "branchId": 1
}
```

## CSV Upload

### `POST /admin/upload-crimes`

Admin-only route. Accepts multipart form data with a `file` field.

Current constraints:

- File extension must be `.csv`.
- Backend file size limit is 1 MB.
- Frontend also checks for CSV and 1 MB before upload.

See `docs/CSV_UPLOAD.md`.

## Statistics

All current statistics endpoints are public.

### `GET /stats/summary`

Returns high-level statistics.

### `GET /stats/crime-type-distribution`

Returns crime counts grouped by crime type. Supports optional date filtering.

### `GET /stats/zone-crime-count`

Returns crime counts grouped by zone. Supports optional filters.

### `GET /stats/crime-trend`

Returns crime trend data. Supports `crimeTypeId`, `start`, and `end`.

## Zones

### `GET /zones`

Public route. Returns zones.

### `GET /zones/severity`

Public route. Returns zone severity data for approved crimes.

Query parameters include:

- `crimeType`
- `zoneId`
- `startDate`
- `endDate`

### `POST /zones/:id/contains`

Public route. Checks whether a latitude/longitude is inside the zone boundary.

Body:

```json
{
  "latitude": 24.9,
  "longitude": 67.05
}
```

## Unknowns

- The repository does not provide a generated OpenAPI specification.
- Some controller response bodies are not centralized and may differ by endpoint.
