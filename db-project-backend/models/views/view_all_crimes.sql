CREATE OR REPLACE VIEW public.view_all_crimes with (security_invoker = on) AS
SELECT
    c.id AS id,
    z.name AS zoneName,
    pb.id AS registeredBranchId,
    crs."submitterCnic" AS submitterCnic,
    ct.name AS crimeTypeName,
    c."incidentDate" AS incidentDate,
    c.status AS status,
    ST_AsGeoJSON(c.location)::json AS location,
    CASE WHEN c.location IS NOT NULL THEN ST_Y(c.location) END AS latitude,
    CASE WHEN c.location IS NOT NULL THEN ST_X(c.location) END AS longitude
FROM "Crime" c
LEFT JOIN "Zone" z
       ON z.id = c."zoneId"
LEFT JOIN LATERAL (
    SELECT pb_inner.id
    FROM "PoliceBranch" pb_inner
    WHERE pb_inner."zoneId" = c."zoneId"
    ORDER BY pb_inner.id ASC
    LIMIT 1
) pb ON true
LEFT JOIN "CrimeType" ct
       ON ct.id = c."crimeTypeId"
LEFT JOIN LATERAL (
    SELECT cs."submitterId"
    FROM "CrimeSubmission" cs
    WHERE cs."CrimeId" = c.id
    ORDER BY cs."submittedAt" DESC
    LIMIT 1
) cs_latest ON true
LEFT JOIN "CrimeReportsSubmitter" crs
       ON crs.id = cs_latest."submitterId"
WHERE c.status = 'approved';
