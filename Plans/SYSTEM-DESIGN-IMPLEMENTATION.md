# CrimeLens System Design Implementation - Master Plan

## Context & Overview

This document serves as the central hub for the CrimeLens system design upgrade implementation. The goal is to transform the current PERN modular monolith into a production-ready, scalable system with comprehensive observability, security, and performance optimization.

### Current Architecture State

**Frontend:** React 19.2 + TypeScript + Vite + Redux Toolkit + Leaflet
**Backend:** Express.js 5.1 + Node.js ES modules + Sequelize ORM
**Database:** PostgreSQL on Supabase with PostGIS
**Authentication:** Dual system - JWT (admin/police) + Supabase Auth (citizens)
**Media:** Cloudinary for upload/transformation/thumbnails
**Deployment:** No containerization or CI/CD configuration

### Implementation Phases

| Phase | Component | Status | Folder |
|-------|-----------|--------|--------|
| 0 | k6 Baseline Testing | ✅ Complete | `Plans/phase-0-k6-baseline/` |
| 1 | PostgreSQL Optimization | ✅ Complete | `Plans/phase-1-postgresql-optimization/` |
| 2 | Health Checks | ✅ Complete | `Plans/phase-2-health-checks/` |
| 3 | Redis Caching | ✅ Complete | `Plans/phase-3-redis-caching/` |
| 4 | Rate Limiting | ✅ Complete | `Plans/phase-4-rate-limiting/` |
| 5 | API Security | ✅ Complete | `Plans/phase-5-api-security/` |
| 6 | HTTP Compression | ✅ Complete | `Plans/phase-6-http-compression/` |
| 7 | Pino Logging | ✅ Complete | `Plans/phase-7-pino-logging/` |
| 8 | Prometheus + Grafana | ✅ Complete | `Plans/phase-8-prometheus-grafana/` |
| 9 | Docker | ✅ Complete | `Plans/phase-9-docker/` |
| 10 | Nginx | ✅ Complete | `Plans/phase-10-nginx/` |
| 11 | Horizontal Scaling | ✅ Complete | `Plans/phase-11-horizontal-scaling/` |
| 12 | BullMQ Workers | ✅ Complete | `Plans/phase-12-bullmq-workers/` |
| 13 | Cloudflare | ✅ Complete | `Plans/phase-13-cloudflare/` |
| 14 | GitHub Actions | ✅ Complete | `Plans/phase-14-cicd/` |
| 15 | k6 Final Testing | ✅ Complete | `Plans/phase-15-k6-final/` |

### Dependency Graph

```
Phase 0 (k6 Baseline)
    ↓
Phase 1 (PostgreSQL)
    ↓
Phase 2 (Health Checks)
    ↓
Phase 3 (Redis)
    ↓
Phase 4 (Rate Limiting)
    ↓
Phase 5 (API Security)
    ↓
Phase 6 (HTTP Compression)
    ↓
Phase 7 (Pino)
    ↓
Phase 8 (Prometheus/Grafana)
    ↓
Phase 9 (Docker)
    ↓
Phase 10 (Nginx)
    ↓
Phase 11 (Horizontal Scaling)
    ↓
Phase 12 (BullMQ)
    ↓
Phase 13 (Cloudflare)
    ↓
Phase 14 (CI/CD)
    ↓
Phase 15 (Final Testing)
```

### Key Design Decisions

1. **Redis-backed Rate Limiting**: Using Redis from the start for distributed rate limiting since the end goal involves horizontal scaling
2. **Health Checks Design**: `/health` for process health, `/ready` for dependency checks (PostgreSQL → PostgreSQL + Redis after Phase 3)
3. **Background Job Candidates**: CSV processing and Cloudinary deletion are the primary candidates for BullMQ
4. **Connection Pool Scaling**: Phase 11 will analyze `API instances × connections ≤ DB capacity`

### Critical Files Reference

**Backend Structure:**
- Entry point: `db-project-backend/server.js`
- Database: `db-project-backend/config/db.js` (Sequelize, pool: max 5, min 0)
- Routes: `db-project-backend/routes/*.js`
- Controllers: `db-project-backend/controllers/*.js`
- Middleware: `db-project-backend/middleware/authMiddleware.js`
- Models: `db-project-backend/models/*.js`

**Frontend Structure:**
- Entry point: `db-project-frontend/src/main.tsx`
- API service: `db-project-frontend/src/services/api.ts`
- Pages: `db-project-frontend/src/pages/*/`
- Store: `db-project-frontend/src/store/`

### Implementation Approach

Each phase folder contains:
1. **Implementation plan** with detailed steps
2. **File changes** with specific code modifications
3. **Testing approach** with verification steps
4. **Dependencies** on previous phases
5. **Rollback procedures** if needed

### Progress Tracking

Update this file as phases are completed:

- [x] Phase 0: Baseline performance metrics recorded
- [x] Phase 1: Pagination implemented, queries optimized
- [x] Phase 2: Health endpoints operational
- [x] Phase 3: Redis caching operational
- [x] Phase 4: Rate limiting enforced
- [x] Phase 5: Security hardening complete
- [x] Phase 6: Compression enabled
- [x] Phase 7: Structured logging operational
- [x] Phase 8: Monitoring dashboard active
- [x] Phase 9: Containerization complete
- [x] Phase 10: Reverse proxy configured
- [x] Phase 11: Multiple instances verified
- [x] Phase 12: Background jobs operational
- [x] Phase 13: CDN configured
- [x] Phase 14: CI/CD pipeline active
- [x] Phase 15: Final scalability report generated

---

## Quick Reference

### Phase Plans Location

All individual phase implementation plans are located in their respective folders under `Plans/`:

```
Plans/
├── SYSTEM-DESIGN-IMPLEMENTATION.md  (this file)
├── phase-0-k6-baseline/plan.md
├── phase-1-postgresql-optimization/plan.md
├── phase-2-health-checks/plan.md
├── phase-3-redis-caching/plan.md
├── phase-4-rate-limiting/plan.md
├── phase-5-api-security/plan.md
├── phase-6-http-compression/plan.md
├── phase-7-pino-logging/plan.md
├── phase-8-prometheus-grafana/plan.md
├── phase-9-docker/plan.md
├── phase-10-nginx/plan.md
├── phase-11-horizontal-scaling/plan.md
├── phase-12-bullmq-workers/plan.md
├── phase-13-cloudflare/plan.md
├── phase-14-cicd/plan.md
└── phase-15-k6-final/plan.md
```

### Estimated Total Implementation Time

| Phase | Duration | Cumulative |
|-------|----------|------------|
| Phase 0 | 3 hours | 3 hours |
| Phase 1 | 4 hours | 7 hours |
| Phase 2 | 2 hours | 9 hours |
| Phase 3 | 5 hours | 14 hours |
| Phase 4 | 3 hours | 17 hours |
| Phase 5 | 4 hours | 21 hours |
| Phase 6 | 2 hours | 23 hours |
| Phase 7 | 4 hours | 27 hours |
| Phase 8 | 6.5 hours | 33.5 hours |
| Phase 9 | 4 hours | 37.5 hours |
| Phase 10 | 3 hours | 40.5 hours |
| Phase 11 | 3.5 hours | 44 hours |
| Phase 12 | 6.5 hours | 50.5 hours |
| Phase 13 | 4 hours* | 54.5 hours |
| Phase 14 | 6.5 hours | 61 hours |
| Phase 15 | 7 hours | 68 hours |

*Plus DNS propagation time (24-48 hours waiting)

**Total Estimated Time: ~68 hours (excluding DNS propagation)**

---

**Next Steps:**
1. Review individual phase plans in respective folders
2. Execute Phase 0 (k6 baseline) to establish performance baseline
3. Proceed sequentially through phases, updating this tracker
4. Generate final before/after scalability report after Phase 15
