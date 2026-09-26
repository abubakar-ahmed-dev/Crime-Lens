# Baseline-comparison environment (recorded 2026-09-18 06:36  local: 2026-09-18 11:36 PST)

| Item | Value |
|---|---|
| Git commit (this rerun) | 63240d2bbdde4036531dd9ee2fc0365e8db22cd5 |
| Baseline reference commit | a112370eb41f9ccf389eefbd819f55248d1a8e91 |
| Date | 2026-09-18 (Friday) |
| Timezone | PST UTC+05 |
| OS | Windows 10 Pro 10.0.19045 (same physical machine as Phase 0) |
| CPU | Intel(R) Core(TM) i5-4300M CPU @ 2.60GHz |
| Available RAM | 1.2 GB free of 8 GB |
| Docker Desktop | WSL2 backend, default limits (host-shared) |
| k6 | k6.exe v2.2.0 (commit/00a9a1b7f5, go1.26.5, windows/amd64) |
| Node | v22.16.0 |
| Backend replicas | 1 (docker compose, forced single) |
| DB pool | DB_POOL_MAX=10, DB_POOL_MIN=0 (compose env default) |
| Database | Supabase PostgreSQL + PostGIS, remote (region: per project settings) |
| Redis | compose redis:7-alpine, cache+limiter, BullMQ on same instance |
| Rate limiter during capacity runs | DISABLED (Phase 0 had none) — restored after |

## Dataset (recorded at rerun time via live API — Phase 0 had 4 zones, 7 crime types, ~8 approved crimes)

| Item | Value |
|---|---|
| Zones | 4 |
| Crime types | 7 |
| Stats summary fields | {"totalZones": 4, "totalCrimes": 6, "topCrimeType": {"id": 1, "name": "Theft", "crimeCount": "5"}, "topZone": {"id": 1, "name": "North Nazimabad", "crimeCount": "6"}} |
