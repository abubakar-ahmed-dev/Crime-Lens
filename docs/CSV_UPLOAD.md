# CSV Upload

CSV upload is an admin-only feature for inserting multiple crime records.

## Route

```http
POST /api/admin/upload-crimes
```

Authorization:

- Admin JWT required.
- Route uses `verifyToken` and `authorizeRoles("admin")`.

Request type:

```http
multipart/form-data
```

File field:

```text
file
```

## File Rules

Configured in `db-project-backend/config/multerConfig.js`:

- Extension must be `.csv`.
- Backend file size limit is 1 MB.
- File is stored in memory during processing.

The frontend upload page also checks:

- MIME type must be `text/csv`.
- Size must be at most 1 MB.

## Required Columns

The upload controller requires:

- `title`
- `crimeTypeId`
- `incidentDate`
- `reportedAt`
- `latitude`
- `longitude`

Optional supported fields include:

- `description`
- `status`
- `address`
- `zoneId`

## Header Normalization

`utils/fileParser.js` normalizes selected headers:

- `crimetypeid`, `crimetype`, `crime_type_id`, `crime type id` -> `crimeTypeId`
- `zoneid`, `zone_id`, `zone id` -> `zoneId`
- `reportedat` -> `reportedAt`
- `incidentdate` -> `incidentDate`

Other headers are trimmed and normalized by removing whitespace and underscores.

## Date Parsing

The upload controller accepts several date formats through `parseFlexibleDate`, including:

- `M/d/yyyy`
- `M/d/yyyy H:mm`
- `M/d/yyyy HH:mm`
- `MM/dd/yyyy`
- `MM/dd/yyyy H:mm`
- `MM/dd/yyyy HH:mm`
- `yyyy-MM-dd`
- `yyyy/MM/dd`
- `yyyy-MM-dd H:mm`
- `yyyy/MM/dd H:mm`
- `yyyy-MM-dd HH:mm:ss`
- `M/d/yyyy h:mm a`

It also falls back to JavaScript `Date` parsing.

## Status Handling

Current allowed CSV statuses:

- `pending`
- `approved`

If a row contains any other status, the controller sets it to `pending`.

CSV import does not accept `rejected` or `deleted` as imported statuses.

## Validation

Current validation checks:

- Required fields exist.
- Latitude and longitude parse as numbers.
- `incidentDate` parses as a valid date.
- `crimeTypeId` exists when crime type reference data is available.
- `zoneId` exists when provided and zone reference data is available.

Invalid rows are counted. Detailed reasons are not returned for all invalid validation paths.

## Duplicate Detection

Duplicate detection is based on a composite key:

- `crimeTypeId`
- `incidentDate`
- `zoneId`
- rounded latitude
- rounded longitude

The helper checks both:

- existing database records
- duplicates inside the uploaded CSV

## Insert Behavior

Valid, non-duplicate rows are inserted into `Crime`.

Inserted fields include:

- `title`
- `description`
- `crimeTypeId`
- `incidentDate`
- `reportedAt`
- `status`
- `location`
- `address`
- `zoneId`

`location` is inserted as a PostGIS point using longitude and latitude.

## Upload Log

After processing, the backend writes `UploadLog`.

Successful uploads use status `completed`.

Failed insert/upload paths use status `failed`.

## Response

Successful response includes:

```json
{
  "success": true,
  "message": "Upload completed",
  "stats": {
    "total": 10,
    "inserted": 8,
    "duplicates": 1,
    "invalid": 1
  }
}
```

## Unknowns

- No sample CSV file is currently included in the repository.
- The frontend displays counts but does not display row-level invalid details.
