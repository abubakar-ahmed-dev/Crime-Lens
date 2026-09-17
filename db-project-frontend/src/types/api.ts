// src/types/api.ts
// Shared API payload types, modeled on the response shapes the backend
// controllers actually return (db-project-backend/controllers/*). Consumers
// are the components under src/; keep in sync with backend contracts.

// ---------------------------------------------------------------------------
// Auth (staff: admin/police, JWT — controllers/authControllers.js login)
// ---------------------------------------------------------------------------

export interface StaffUser {
  id: number;
  username: string;
  role: string;
  role_id: number;
}

type StaffLoginSuccess = {
  success: true;
  message?: string;
  token: string;
  user: StaffUser;
};

type StaffLoginFailure = {
  success: false;
  message?: string;
};

export type StaffLoginResponse = StaffLoginSuccess | StaffLoginFailure;
