# CrimeLens Project Analysis Report

## 1. Project Purpose

CrimeLens is a **city-level crime reporting, mapping, verification, and analytics platform** designed for:

- **Citizens**: Report crime incidents, track submission status, view public crime data
- **Police Officers**: Verify pending reports, approve/reject submissions, manage approved crime records
- **Administrators**: Manage organizational structure (branches, agents), bulk data import, system oversight
- **Public Users**: View interactive crime maps, statistics, and dashboards without authentication

The core workflow involves citizens submitting reports → police verifying them → approved records becoming visible on public maps and statistics.

## 2. Technology Stack

### Backend (Node.js/Express)
- **Framework**: Express.js 5.1.0
- **Database ORM**: Sequelize 6.37.7
- **Database**: PostgreSQL (via Supabase)
- **Spatial Extensions**: PostGIS for geographic queries
- **Authentication**:
  - JWT (jsonwebtoken) for Admin/Police users
  - Supabase Auth for Citizen users
- **File Processing**: Multer (file uploads), fast-csv (CSV parsing)
- **Security**: bcrypt/bcryptjs for password hashing
- **Other**: cors, dotenv, date-fns

### Frontend (React/TypeScript)
- **Framework**: React 19.2.0 with TypeScript
- **Build Tool**: Vite 7.1.7
- **Routing**: React Router DOM 7.9.5
- **State Management**: Redux Toolkit
- **Maps**: Leaflet 1.9.4, React Leaflet 5.0.0
- **Charts**: Recharts 3.3.0
- **Styling**: Tailwind CSS 4.1.15
- **Icons**: Lucide React
- **HTTP Client**: Axios
- **Notifications**: React Hot Toast

### Database & Auth
- **Supabase PostgreSQL**: Primary data storage
- **PostGIS**: Geographic data (points, polygons) and spatial validation
- **Supabase Auth**: Citizen authentication (email/password + Google OAuth)

## 3. High-Level Architecture

### System Design
```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                       │
│  ┌──────────────┬──────────────┬──────────────────────────┐ │
│  │ Public Views │ Citizen Views │ Admin/Police Views       │ │
│  └──────────────┴──────────────┴──────────────────────────┘ │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTP/HTTPS
┌───────────────────────────┴─────────────────────────────────┐
│                  Backend API (Express)                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Routes → Controllers → Models → Database                │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌───────────────┬──────────────────┬─────────────────────┐ │
│  │ JWT Middleware │ Supabase Auth    │ Authorization       │ │
│  │ (Admin/Police) │ (Citizens)        │ (Role-based)        │ │
│  └───────────────┴──────────────────┴─────────────────────┘ │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────┴─────────────────────────────────┐
│                  Supabase PostgreSQL + PostGIS                │
│  Crime, CrimeType, Zone, User, Role, CrimeSubmission, etc.  │
└──────────────────────────────────────────────────────────────┘
```

### Major Modules

1. **Authentication Module**
   - Admin/Police: JWT-based authentication via `/api/auth/login`
   - Citizens: Supabase Auth via `/api/citizens/*` endpoints
   - Dual middleware: `verifyToken`, `authorizeCitizen`, `authorizeAny`

2. **Crime Management Module**
   - Crime submission (citizens)
   - Crime verification (police)
   - Crime updates/deletes (police)
   - Public crime queries (map views)

3. **User Management Module**
   - Admin controls (branches, agents, assignments)
   - Police agent request processing
   - Citizen profile management

4. **Statistics & Analytics Module**
   - Crime statistics aggregation
   - Map-based filtering (radius, type, zone, date)

5. **Data Import Module**
   - CSV bulk upload for admin users

## 4. Project Structure

```
CrimeLens-main/
├── db-project-backend/          # Express backend API
│   ├── config/
│   │   ├── db.js                # Sequelize configuration
│   │   ├── envValidation.js     # Environment variable validation
│   │   ├── multerConfig.js     # File upload configuration
│   │   └── supabase.js          # Supabase client
│   ├── controllers/
│   │   ├── adminControls/       # Admin-specific controllers
│   │   ├── authControllers.js   # Admin/Police auth
│   │   ├── citizenAuthController.js  # Citizen auth
│   │   ├── CrimeControllers.js # Crime CRUD
│   │   ├── statsController.js  # Statistics
│   │   └── zoneController.js    # Zone management
│   ├── middleware/
│   │   └── authMiddleware.js   # JWT & citizen auth middleware
│   ├── models/
│   │   ├── Crime.js            # Crime records model
│   │   ├── CrimeType.js         # Crime categories
│   │   ├── CrimeSubmission.js  # Crime-submitter linkage
│   │   ├── CrimeReportsSubmitter.js  # Citizen profiles
│   │   ├── Zone.js              # Geographic zones (PostGIS)
│   │   ├── User.js              # Admin/Police users
│   │   ├── Role.js              # Role definitions
│   │   ├── PoliceBranch.js     # Police branches
│   │   └── PoliceAgentRequest.js  # Agent applications
│   ├── routes/
│   │   ├── adminRoutes.js       # Admin endpoints
│   │   ├── authRoutes.js        # Admin/Police login
│   │   ├── citizenAuthRoutes.js # Citizen auth/profile
│   │   ├── crimeRoutes.js       # Crime endpoints
│   │   ├── statsRoutes.js       # Statistics endpoints
│   │   └── zoneRoutes.js        # Zone endpoints
│   ├── utils/
│   │   ├── apiResponse.js       # Response formatting
│   │   ├── bulkInsertHelper.js # CSV import helpers
│   │   └── fileParser.js        # File parsing utilities
│   ├── server.js                # Application entry point
│   └── .env-sample              # Environment template
│
├── db-project-frontend/         # React frontend
│   └── src/
│       ├── components/           # Reusable UI components
│       ├── context/
│       │   └── AuthContext.tsx  # Auth state management
│       ├── layouts/             # Page layouts
│       ├── pages/
│       │   ├── HomePage/        # Public landing page
│       │   ├── MapViewPage/     # Interactive crime map
│       │   ├── StatisticsPage/  # Crime statistics
│       │   ├── ReportCrimePage/ # Citizen reporting
│       │   ├── VerificationPage/ # Police verification
│       │   ├── DashboardPage/   # Role-based dashboards
│       │   ├── AdminControlsPage/ # Admin controls
│       │   └── AuthCallback/     # OAuth callback handler
│       ├── routes/
│       │   └── index.tsx        # Route definitions
│       ├── services/            # API service layer
│       ├── store/               # Redux store
│       ├── App.tsx              # Root component
│       └── main.tsx             # Application entry
│
└── docs/                        # Detailed documentation
    ├── SETUP.md
    ├── ARCHITECTURE.md
    ├── API.md
    ├── DATABASE.md
    ├── AUTHORIZATION.md
    └── FRONTEND_ROUTES.md
```

## 5. Application Flow

### Typical Request Flow (Admin/Police)
```
1. Client → HTTP Request with JWT in Authorization header
2. Express Router → Route matching
3. verifyToken Middleware → JWT validation
4. authorizeRoles Middleware → Role check
5. Controller → Business logic
6. Sequelize Model → Database query
7. Database → Response data
8. Controller → JSON response
9. Client → UI update
```

### Typical Request Flow (Citizen)
```
1. Client → HTTP Request with Supabase JWT in Authorization header
2. Express Router → Route matching
3. authorizeCitizen Middleware → Supabase token validation
4. Controller → Business logic
5. Sequelize Model → Database query
6. Database → Response data
7. Controller → JSON response
8. Client → UI update
```

### Crime Report Submission Flow
```
1. Citizen: Authenticated via Supabase
2. POST /api/crimes/report with crime details (location, type, description)
3. Controller: Validates coordinates, checks profile completion
4. Database: Creates Crime record (status=pending)
5. Database: Creates CrimeSubmission record (links crime to citizen)
6. Response: Success with crime + submission IDs
7. Police: Views pending reports in verification queue
8. Police: Approve/Reject with optional updates
9. Database: Updates Crime status to approved/rejected
10. Public: Approved crimes visible on map
```

## 6. Database

### Database Technology
- **PostgreSQL** hosted on Supabase
- **PostGIS** extension for spatial operations

### Schema Summary

**Core Tables:**
- **Crime**: Crime records with location (PostGIS POINT), status, type reference
- **CrimeType**: Crime categories (e.g., "Theft", "Assault")
- **CrimeSubmission**: Links crimes to citizen submitters (UUID-based)
- **CrimeReportsSubmitter**: Citizen profiles for crime reporting

**Organizational Tables:**
- **User**: Admin and Police user accounts (JWT-based auth)
- **Role**: Role definitions (admin, police)
- **Zone**: Geographic zones with PostGIS POLYGON boundaries
- **PoliceBranch**: Police stations assigned to zones
- **PoliceAgentRequest**: Police agent applications
- **PoliceAgentRequestsTemp**: Temporary agent request storage

**System Tables:**
- **UploadLog**: CSV import audit trail

### Key Relationships
```
Crime ──belongTo──> CrimeType
Crime ──belongTo──> Zone
Crime ──belongTo──> User (as latestUpdater)
Crime ─<hasMany── CrimeSubmission

CrimeSubmission ──belongTo──> Crime
CrimeSubmission ──belongTo──> CrimeReportsSubmitter

Zone ─<hasMany── PoliceBranch
Zone ─<hasMany── Crime

PoliceBranch ──belongTo──> Zone
PoliceBranch ──belongTo──> User (branchHead)

User ──belongTo──> Role
```

### Spatial Features
- Crime locations stored as `GEOMETRY(POINT, 4326)`
- Zone boundaries as `GEOMETRY(POLYGON, 4326)`
- Spatial queries: `ST_DWithin` (radius search), `ST_Covers` (zone validation)
- GIST indexes on spatial columns

## 7. Authentication & Authorization

### Dual Authentication Systems

#### Admin/Police Users (JWT-based)
- **Endpoint**: `POST /api/auth/login`
- **Flow**:
  1. User submits username/password
  2. Server validates against User table
  3. Server returns JWT signed with `JWT_SECRET`
  4. Client stores token in localStorage
  5. Subsequent requests include `Authorization: Bearer <token>`
- **Middleware**: `verifyToken` validates JWT, `authorizeRoles` checks permissions

#### Citizen Users (Supabase Auth)
- **Endpoints**:
  - `POST /api/citizens/register`: Email/password registration
  - `POST /api/citizens/login`: Email/password login
  - `POST /api/citizens/google-auth`: Google OAuth initiation
- **Flow**:
  1. User registers/logs in via Supabase
  2. Server returns Supabase session token
  3. Client stores token in localStorage
  4. `authorizeCitizen` middleware validates with Supabase
- **Google OAuth**: Redirects to `/auth/callback` after authentication

### Role-Based Access Control

**Roles:**
- `admin`: Full system access, CSV upload, user management
- `police`: Crime verification, record management
- `user`: Citizens (via Supabase Auth)

**Protected Endpoints:**
- `/api/admin/*` → Admin only
- `/api/crimes/all`, `/api/crimes/update`, `/api/crimes/delete` → Police only
- `/api/citizens/profile`, `/api/citizens/my-reports` → Citizens only

## 8. API Summary

### Crime Endpoints
- `GET /api/crimes/` - Public map data (approved crimes only)
- `GET /api/crimes/types` - All crime types
- `GET /api/crimes/all` - All crimes (police only)
- `GET /api/crimes/get-crime/:id` - Single crime details
- `PUT /api/crimes/update/:id` - Update crime (police only)
- `DELETE /api/crimes/delete/:id` - Soft delete (police only)
- `POST /api/crimes/report` - Submit crime report (citizens)
- `GET /api/crimes/pending` - Pending submissions (police)
- `POST /api/crimes/approve/:submissionId` - Approve report (police)
- `POST /api/crimes/reject/:submissionId` - Reject report (police)

### Auth Endpoints
- `POST /api/auth/login` - Admin/Police login
- `POST /api/citizens/register` - Citizen registration
- `POST /api/citizens/login` - Citizen login
- `POST /api/citizens/google-auth` - Google OAuth
- `GET /api/citizens/profile` - Citizen profile
- `PUT /api/citizens/profile` - Complete/update profile
- `GET /api/citizens/my-reports` - User's submitted reports

### Admin Endpoints
- `POST /api/admin/upload-crimes` - CSV bulk upload
- `GET /api/admin/branches` - List branches
- `POST /api/admin/branches` - Create branch
- `PUT /api/admin/branches/:branchId/head` - Assign branch head
- `GET /api/admin/police-agents` - List agents
- `POST /api/admin/police-agents` - Create agent

### Statistics Endpoints
- `GET /api/stats/*` - Various crime statistics (public)

### Zone Endpoints
- `GET /api/zones/*` - Zone data for map polygons

## 9. Configuration

### Backend Environment Variables (.env)
**Required:**
- `DATABASE_URL` - Supabase PostgreSQL connection string
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `JWT_SECRET` - JWT signing secret

**Optional (with defaults):**
- `PORT` - Server port (default: 5001)
- `CORS_ORIGINS` - Allowed frontend origins (default: http://localhost:5173)
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `NODE_ENV` - Environment mode

### Frontend Environment Variables (.env)
- `VITE_API_BASE_URL` - Backend API base URL (default: http://localhost:5001/api)
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key

## 10. Missing or Unclear Areas

### Cannot Be Determined from Code
1. **Initial Data Seeding**: No seed files found - initial crime types, zones, or admin account creation process is unclear
2. **Supabase Setup SQL**: While models define schema, actual Supabase SQL setup scripts are not visible in the analyzed files
3. **Email Templates**: Email verification content/template configuration not visible
4. **Rate Limiting**: No rate limiting middleware detected
5. **Logging Strategy**: Minimal structured logging configuration

### Areas That May Require Clarification
1. **Zone Boundary Definition**: How zone polygons are initially populated/defined
2. **Crime Type Initialization**: Process for defining initial crime categories
3. **Admin Account Creation**: First admin setup process
4. **PostGIS Extension Setup**: Database initialization steps
5. **Session Refresh Behavior**: Edge cases in Supabase token refresh not fully documented
6. **Error Recovery**: Database connection failure handling beyond basic startup checks

### Known Issues (from docs)
- Documentation exists for `KNOWN_ISSUES.md` and `REQUIRED_FIXES.md` - content not analyzed in this review

---

**Analysis Scope**: This report is based on codebase analysis only. No external documentation beyond the included README.md was consulted. For setup instructions, please refer to `docs/SETUP.md`.

**Generated**: 2026-08-19
