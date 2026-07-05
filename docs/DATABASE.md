# Database

CrimeLens uses Supabase PostgreSQL with Sequelize models and raw SQL queries.

PostGIS is required for geospatial columns and zone-boundary checks.

## Setup Files

- `db-project-backend/scripts/supabase-setup.sql` - main setup SQL.
- `db-project-backend/scripts/Latest_schema.sql` - exported/latest schema snapshot.
- `db-project-backend/models/*.js` - Sequelize model definitions.
- `db-project-backend/models/views/*.sql` - SQL views used by current query patterns.

## Extensions

The setup SQL enables:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

## Tables

### `Role`

Stores staff/user role definitions.

Columns:

- `id`
- `name`
- `description`

Seeded roles in setup SQL:

- `admin`
- `police`
- `user`

### `User`

Stores admin and police users for JWT-based login.

Columns:

- `id`
- `username`
- `passwordHash`
- `roleId`
- `createdAt`
- `updatedAt`

Relationships:

- Belongs to `Role` through `roleId`.
- May be referenced by `PoliceBranch.branchHeadUserId`.
- May be referenced by `PoliceAgentRequest.userId`.
- May be referenced by `Crime.latestUpdatedBy`.

### `CrimeReportsSubmitter`

Stores citizen profile data linked to Supabase Auth.

Columns:

- `id` UUID primary key.
- `submitterCnic` nullable unique text.
- `supabaseUserId` nullable unique text.
- `email` unique text.
- `fullName`
- `contact`
- `address`
- `isProfileComplete`
- `createdAt`
- `updatedAt`

Current behavior:

- Citizen account creation creates a row with nullable `submitterCnic`.
- Profile completion updates CNIC/contact/address.
- Report ownership uses `id`, not CNIC.

### `CrimeType`

Stores crime categories and severity values.

Columns:

- `id`
- `name`
- `severity`

Seeded types in setup SQL:

- Theft
- Assault
- Robbery
- Burglary
- Vandalism
- Fraud
- Other

### `Zone`

Stores named geographic zones.

Columns:

- `id`
- `name`
- `boundary` as `GEOMETRY(POLYGON, 4326)`

Used for:

- Map filtering.
- Statistics grouping.
- Police approval/update location validation.
- Police branch assignment.

The setup SQL creates the table but does not seed zone boundaries.

### `PoliceBranch`

Stores police branches assigned to zones.

Columns:

- `id`
- `branchHeadUserId`
- `zoneId`
- `name`
- `address`
- `contactNumber`
- `location` as `GEOMETRY(POINT, 4326)`

Relationships:

- Belongs to `Zone` through `zoneId`.
- Belongs to `User` through `branchHeadUserId`.
- Has many `PoliceAgentRequest` rows through `branchId`.

`zoneId` is unique, so one branch is associated with one zone.

### `Crime`

Stores crime records.

Columns:

- `id`
- `title`
- `description`
- `crimeTypeId`
- `incidentDate`
- `reportedAt`
- `status`
- `location` as `GEOMETRY(POINT, 4326)`
- `address`
- `zoneId`
- `latestUpdatedBy`

Current status values:

- `pending`
- `approved`
- `rejected`
- `deleted`

Relationships:

- Belongs to `CrimeType`.
- Belongs to `Zone`.
- Belongs to `User` as `latestUpdater`.
- Has many `CrimeSubmission`.

Current behavior:

- Citizen reports create `pending` crimes.
- Police approval sets status to `approved` and stores `latestUpdatedBy`.
- Police updates also store `latestUpdatedBy`.
- Delete is soft delete: status becomes `deleted`.
- Public map/statistics use approved records.

### `CrimeSubmission`

Links citizen submitters to crime records.

Columns:

- `id`
- `submitterId`
- `submittedAt`
- `CrimeId`

Relationships:

- Belongs to `CrimeReportsSubmitter` through `submitterId`.
- Belongs to `Crime` through `CrimeId`.

Current behavior:

- `CrimeId` is not nullable.
- `submitterId` is not nullable.
- Legacy `userId` and `submitterCnic` columns are not part of the current model.

### `PoliceAgentRequestsTemp`

Stores temporary credentials submitted in public police agent account requests.

Columns:

- `id`
- `username`
- `password`
- `createdAt`

### `PoliceAgentRequest`

Tracks police agent requests and approved agent/branch association.

Columns:

- `id`
- `policeAgentRequestsTempId`
- `userId`
- `branchId`
- `status`
- `createdAt`

Status values:

- `pending`
- `approved`
- `rejected`

Relationships:

- Belongs to `PoliceAgentRequestsTemp`.
- Belongs to `User`.
- Belongs to `PoliceBranch`.

### `UploadLog`

Stores CSV upload summaries.

Columns:

- `id`
- `filename`
- `status`
- `totalRecords`
- `recordsUploaded`
- `uploadedAt`

Model status values:

- `completed`
- `failed`

The setup SQL enum also includes `uploaded`. Current controller writes `completed` or `failed`.

### `activitylog`

Exists in setup SQL and latest schema.

Columns in setup SQL:

- `id`
- `tablename`
- `recordid`
- `action`
- `description`
- `createdat`

Current code does not define a Sequelize model for `activitylog`, and no trigger/function implementation was found in the current setup SQL.

## Views

View SQL files exist under `db-project-backend/models/views/`:

- `viewAllAgents.sql`
- `view_all_crimes.sql`
- `view_PendingSubmissions.sql`

The setup SQL does not currently create these views. If the deployment requires these views, run the SQL files separately or add them to the setup flow.

## Indexes

Setup SQL creates B-tree indexes for common fields and GIST indexes for geospatial fields:

- `Crime.crimeTypeId`
- `Crime.reportedAt`
- `Crime.status`
- `Crime.zoneId, Crime.reportedAt`
- `Crime.location` GIST
- `PoliceBranch.location` GIST
- `Zone.boundary` GIST
- citizen profile indexes on `id`, `supabaseUserId`, `email`, `isProfileComplete`
- `CrimeSubmission.submitterId`

## Unknowns

- Production seed data for zones is not included in the repository.
- Whether `activitylog` should be filled by database triggers is not implemented in current code.
- The exact live database contents cannot be determined from code.
