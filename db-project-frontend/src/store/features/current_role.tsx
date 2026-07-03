
// export const { setRole, clearRole } = currentRoleSlice.actions;
// export default currentRoleSlice.reducer;
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type UserRole = "admin" | "police" | "user" | null;

interface CurrentRoleState {
  role: UserRole;
  roleLoaded: boolean;
}

// Get initial role from localStorage
const getInitialRole = (): UserRole => {
  const authMode = localStorage.getItem("authMode");
  if (authMode === "staff") {
    const storedRole = localStorage.getItem("staffRole");
    if (storedRole === "admin" || storedRole === "police") {
      return storedRole;
    }
  }

  const storedRole = localStorage.getItem("userRole");
  if (storedRole === "user") {
    return "user";
  }
  return null;
};

// Get initial roleLoaded state from localStorage
const getInitialRoleLoaded = (): boolean => {
  return getInitialRole() !== null;
};

const initialState: CurrentRoleState = {
  role: getInitialRole(),
  roleLoaded: getInitialRoleLoaded(),
};

export const currentRoleSlice = createSlice({
  name: "currentRole",
  initialState,
  reducers: {
    setRole: (state, action: PayloadAction<UserRole>) => {
      state.role = action.payload;
      state.roleLoaded = true;
      // Persist to localStorage
      if (action.payload) {
        localStorage.setItem("userRole", action.payload);
        if (action.payload === "admin" || action.payload === "police") {
          localStorage.setItem("authMode", "staff");
          localStorage.setItem("staffRole", action.payload);
        } else if (!localStorage.getItem("citizen_token")) {
          localStorage.setItem("authMode", "public");
        }
      }
    },
    clearRole: (state) => {
      state.role = null;
      state.roleLoaded = false;
      // Remove from localStorage
      localStorage.removeItem("userRole");
      localStorage.removeItem("staffRole");
      if (localStorage.getItem("authMode") !== "citizen") {
        localStorage.removeItem("authMode");
      }
    },
  },
});

export const { setRole, clearRole } = currentRoleSlice.actions;
export default currentRoleSlice.reducer;
