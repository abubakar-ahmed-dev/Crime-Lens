import { configureStore } from "@reduxjs/toolkit";
import currentRoleReducer from "./features/current_role";

export const store = configureStore({
  reducer: {
    currentRole: currentRoleReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
