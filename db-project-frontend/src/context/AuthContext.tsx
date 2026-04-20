// src/context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { loginUser, setAuthToken } from "../services/api";

type UserType = {
  id: string;
  username: string;
  role: string;
  role_id?: number;
};

type AuthContextType = {
  user: UserType | null;
  token: string | null;
  login: (username: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserType | null>(() => {
    try {
      const s = localStorage.getItem("user");
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));

  useEffect(() => {
    // ensure axios has token header on start if present
    if (token) setAuthToken(token);
  }, [token]);

  const login = async (username: string, password: string) => {
    try {
      const data = await loginUser(username, password);
      if (!data || !data.success) {
        return { success: false, message: data?.message || "Login failed" };
      }

      const receivedToken = data.token;
      const receivedUser = data.user;

      // persist
      localStorage.setItem("token", receivedToken);
      localStorage.setItem("user", JSON.stringify(receivedUser));
      setAuthToken(receivedToken);
      setToken(receivedToken);
      setUser(receivedUser);

      return { success: true };
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || err?.response?.data?.error || "Login failed. Try again.";
      return { success: false, message: msg };
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setAuthToken(null);
    setToken(null);
    setUser(null);
    // optionally redirect to login page from caller
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
