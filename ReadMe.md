# CrimeLens

CrimeLens is a crime mapping, reporting, verification, and analytics platform. It brings public crime visibility, citizen reporting, police verification, and administrative controls into one web application.

The main idea behind CrimeLens is simple: citizens can report incidents, police can verify and manage those reports, and the public can explore approved crime data through maps and statistics.


🔗 **Live Demo:** [https://crimelens-ten.vercel.app](https://crimelens-ten.vercel.app)

---


## Overview

CrimeLens is designed for a city-level crime reporting and monitoring workflow.

Public users can explore approved crime records through an interactive map and statistics dashboard. Citizens can create accounts, complete their profiles, submit crime reports with location details, and track the status of their submitted reports. Police users can verify pending reports, correct details, validate locations against zone boundaries, and maintain crime records. Admin users can manage branches, police agents, agent requests, branch heads, and CSV-based data imports.

The system uses role-based access so each user type only sees the features intended for them.

## User Roles

### Public Users

Public users can:

- View the homepage.
- Open the live crime map.
- View statistics and public dashboards.
- Request a police agent account.

### Citizens

Citizens can:

- Register and log in.
- Complete their profile.
- Submit crime reports.
- Select location manually, from current device location, or from a map.
- Track pending, approved, and rejected reports from their dashboard.

### Police Users

Police users can:

- View pending crime reports.
- Approve or reject crime reports.
- Update approved crime records.
- Validate that crime locations are inside selected zone boundaries.
- Soft-delete crime records.

### Admin Users

Admins can:

- Verify police agent requests.
- View and manage police agent records.
- Upload bulk crime data through CSV.
- Create police branches.
- Create police agents directly.
- Assign or clear branch heads.

## Core Features

### Interactive Crime Map

CrimeLens includes a public map that displays approved crime records. Users can filter map data by crime type, zone, date range, and radius-based location search.

### Crime Statistics

The statistics pages provide summaries and charts for approved crime records, including crime type distribution, zone-wise crime counts, and trend views.

### Citizen Crime Reporting

Citizens submit reports through a protected reporting form. Reports are created as pending records until reviewed by police.

### Police Verification Workflow

Police review pending reports, update important details, verify the selected location, and approve or reject the report. Approved records become part of public crime data.

### Admin Management

Admin controls support operational management, including branches, branch heads, direct agent creation, agent request approval, and bulk crime import.

### CSV Import

Admins can upload CSV files to insert multiple crime records. The current CSV import supports pending and approved statuses, validates required fields, detects duplicates, and logs upload results.

## Technology Stack

### Frontend

- React
- TypeScript
- Vite
- React Router
- Redux Toolkit
- Supabase JavaScript client
- Leaflet and React Leaflet
- Recharts
- Tailwind utility classes
- Lucide React icons

### Backend

- Node.js
- Express
- Sequelize
- PostgreSQL
- Supabase
- PostGIS
- JWT
- bcrypt / bcryptjs
- Multer
- fast-csv

### Database And Auth

- Supabase PostgreSQL stores application data.
- PostGIS supports map coordinates, zone boundaries, and spatial validation.
- Supabase Auth handles citizen authentication.
- Backend JWT authentication handles admin and police users.

## Project Structure

```text
db-project-frontend/   React frontend application
db-project-backend/    Express backend API and database models
docs/                  Detailed documentation
```

## Documentation

Detailed documentation is available in the `docs/` folder:

- [Setup Guide](docs/SETUP.md)
- [Architecture](docs/ARCHITECTURE.md)
- [API Reference](docs/API.md)
- [Database](docs/DATABASE.md)
- [Authorization](docs/AUTHORIZATION.md)
- [Frontend Routes](docs/FRONTEND_ROUTES.md)
- [CSV Upload](docs/CSV_UPLOAD.md)

## Local Setup

Use the setup guide for detailed instructions:

- [docs/SETUP.md](docs/SETUP.md)

At a high level:

1. Configure the backend `.env`.
2. Run the Supabase setup SQL.
3. Start the backend server.
4. Configure the frontend `.env`.
5. Start the frontend development server.

## Current Status

CrimeLens is built as an academic and demonstration project. It currently includes public data views, citizen reporting, police verification, admin controls, CSV upload, role-based access, and Supabase-backed citizen authentication.
