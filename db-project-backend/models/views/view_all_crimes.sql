CREATE OR REPLACE VIEW public.view_all_crimes with (security_invoker = on) AS
SELECT
    c.id AS id,
    z.name AS zoneName,
    pb.id AS registeredBranchId,
    crs."submitterCnic" AS submitterCnic,
    ct.name AS crimeTypeName,
    c."incidentDate" AS incidentDate
FROM "Crime" c
LEFT JOIN "Zone" z
       ON z.id = c."zoneId"
LEFT JOIN "PoliceBranch" pb
       ON pb."zoneId" = c."zoneId"
LEFT JOIN "CrimeType" ct
       ON ct.id = c."crimeTypeId"
LEFT JOIN "CrimeSubmission" cs
       ON cs."CrimeId" = c.id
LEFT JOIN "CrimeReportsSubmitter" crs
       ON crs.id = cs."submitterId";
