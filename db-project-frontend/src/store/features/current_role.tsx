// //current_role.tsx
// import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

// export type UserRole = "admin" | "police" | "user" | null;

// interface CurrentRoleState {
//   role: UserRole;
//   roleLoaded: boolean;
// }

// const initialState: CurrentRoleState = {
//   role: null,
//   roleLoaded: false,
// };

// export const currentRoleSlice = createSlice({
//   name: "currentRole",
//   initialState,
//   reducers: {
//     setRole: (state, action) => {
//       state.role = action.payload;
//       state.roleLoaded = true;
//     },
//     clearRole: (state) => {
//       state.role = "user";
//       state.roleLoaded = false;
//     },
//   },
// });


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
  const storedRole = localStorage.getItem("userRole");
  if (storedRole === "admin" || storedRole === "police" || storedRole === "user") {
    return storedRole;
  }
  return null;
};

// Get initial roleLoaded state from localStorage
const getInitialRoleLoaded = (): boolean => {
  return localStorage.getItem("userRole") !== null;
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
      }
    },
    clearRole: (state) => {
      state.role = null;
      state.roleLoaded = false;
      // Remove from localStorage
      localStorage.removeItem("userRole");
    },
  },
});

export const { setRole, clearRole } = currentRoleSlice.actions;
export default currentRoleSlice.reducer;
