# 🚔 Crime Mapping & Analytics System

A full-stack web application for crime reporting, verification, and geospatial analytics. The system enables role-based access for Admin, Police, and Public users, and provides powerful insights through maps, trends, and data-driven dashboards.

🔗 **Live Demo:** [https://crimelens-ten.vercel.app](https://crimelens-ten.vercel.app)

---

## 📌 Overview

The Crime Mapping & Analytics System is designed to streamline crime reporting and provide actionable insights using geospatial data. It allows users to report incidents, authorities to verify and manage them, and stakeholders to analyze crime patterns through interactive visualizations.

---

## ✨ Features

### 🔐 Authentication & Authorization

* JWT-based authentication
* Role-based access control (Admin, Police, Public)
* Protected API routes and client-side routing

### 📝 Crime Reporting Workflow

* Submit crime reports with location data
* Verification and approval system for authorities
* Structured form handling with validation
* Bulk dataset import via CSV with logging

### 🗺️ Geospatial Capabilities

* PostGIS-powered location-based data storage
* Nearby crime detection
* Area-based filtering and querying
* Optimized spatial indexing for performance

### 📊 Analytics & Visualization

* Crime trends and patterns
* Hotspot detection
* Zone-wise comparisons
* Interactive dashboards with:

  * Maps
  * Charts
  * Data tables (search, filter, sort)

### ⚙️ System Reliability

* Centralized error handling
* Audit logging for traceability
* Scalable RESTful API architecture

---

## 🛠️ Tech Stack

### Frontend

* React.js
* State Management (Context API / Redux)
* Responsive UI Design

### Backend

* Node.js
* Express.js
* RESTful API Architecture

### Database

* PostgreSQL
* Supabase
* Sequelize ORM
* PostGIS (for geospatial data)

### Other Tools & Concepts

* JWT Authentication
* Middleware-based request handling
* CSV parsing and validation using Multer
* Geospatial indexing and queries
* Crime Analytics using Leaflet Js

---

## 🔍 Key Highlights

* Designed scalable REST APIs for real-world workflows
* Implemented geospatial queries using PostGIS
* Built role-based secure system with JWT authentication
* Developed interactive dashboards with real-time data
* Optimized database with indexing for performance
* Ensured reliability with logging and error handling

---

## 📄 License

This project is for academic and demonstration purposes.
