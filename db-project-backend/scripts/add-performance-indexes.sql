-- ============================================================
-- Phase 1: Performance indexes (PostgreSQL optimization)
--
-- Applied set is based on a live pg_indexes audit (2026-08-31),
-- NOT on the original plan assumptions:
--
--   Already present in the live DB (from supabase-setup.sql and
--   migration-media-upload.sql) — NOT recreated here:
--     Crime(crimeTypeId), Crime(reportedAt), Crime(status),
--     Crime(zoneId, reportedAt), GIST Crime(location),
--     CrimeMedia(CrimeId), CrimeMedia(CrimeId, visibility)   <- plan's
--     "idx_crime_media_visibility" target already exists as
--     "idx_crime_media_crime_visibility"
--
--   Skipped as redundant:
--     idx_crime_type_status (crimeTypeId, status)  — leftmost prefix of
--       idx_crime_stats_covering below.
--
-- All statements are guarded (safe to re-run).
-- ============================================================

-- Map hot path: WHERE status = 'approved' ORDER BY "reportedAt" DESC
-- (also serves generic status+recency filters)
CREATE INDEX IF NOT EXISTS idx_crime_status_reported
  ON "Crime"(status, "reportedAt" DESC);

-- Smallest index matching the approved-crime hot path exactly
-- (map query, stats counts, /api/crimes/all)
CREATE INDEX IF NOT EXISTS idx_crime_approved_date
  ON "Crime"("reportedAt" DESC) WHERE status = 'approved';

-- Serves stats GROUP BY crimeTypeId over approved crimes
-- (crime-type-distribution, summary top-type) with recency for trend filters
CREATE INDEX IF NOT EXISTS idx_crime_stats_covering
  ON "Crime"("crimeTypeId", status, "reportedAt");

-- Zone-filtered approved-crime queries (map zone filter, zone-crime-count).
-- Complements existing Crime(zoneId, reportedAt): this one leads with the
-- equality on status used by every public query.
CREATE INDEX IF NOT EXISTS idx_crime_zone_status
  ON "Crime"("zoneId", status);

ANALYZE "Crime";
ANALYZE "CrimeMedia";
ANALYZE "CrimeType";
ANALYZE "Zone";

-- Post-apply report (run manually or via the verification script):
-- SELECT tablename, indexname, indexdef FROM pg_indexes
-- WHERE schemaname='public'
--   AND tablename IN ('Crime','CrimeMedia','CrimeType','Zone')
-- ORDER BY tablename, indexname;
