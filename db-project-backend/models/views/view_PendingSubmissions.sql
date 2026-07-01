
-- suggested by supabase for security

create or replace view public.view_PendingSubmissions with (security_invoker = on) as
 SELECT c.id,
    c.title,
    c.description,
    c.address,
    c."crimeTypeId",
    json_build_object('id', ct.id, 'name', ct.name) AS "CrimeType",
    c."zoneId",
    json_build_object('id', z.id) AS "Zone",
    c.status,
    c."reportedAt",
    c."incidentDate",
    CASE WHEN c.location IS NOT NULL THEN ST_Y(c.location::geometry) END AS latitude,
    CASE WHEN c.location IS NOT NULL THEN ST_X(c.location::geometry) END AS longitude,
    cs_latest.id AS "submissionId",
    crs."submitterCnic",
    cs_latest."submittedAt",
    crs."fullName",
    crs.contact
   FROM "Crime" c
     LEFT JOIN "CrimeType" ct ON ct.id = c."crimeTypeId"
     LEFT JOIN "Zone" z ON z.id = c."zoneId"
     LEFT JOIN LATERAL ( SELECT cs.id,
            cs."submitterId",
            cs."submittedAt",
            cs."CrimeId"
           FROM "CrimeSubmission" cs
          WHERE cs."CrimeId" = c.id
          ORDER BY cs."submittedAt" DESC
         LIMIT 1) cs_latest ON true
     LEFT JOIN "CrimeReportsSubmitter" crs ON crs.id = cs_latest."submitterId"
  WHERE c.status = 'pending'::"enum_Crime_status"
  ORDER BY c."reportedAt" DESC;
