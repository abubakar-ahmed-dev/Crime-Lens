// src/context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { loginUser, setAuthToken } from "../services/api";
import { API_BASE_URL } from "../config/constants";

// Supabase configuration
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://jgxizgpxxdawcgdxrlfe.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpneGl6Z3B4eGRhd2NnZHhybGZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTgzNDE1MzgsImV4cCI6MjAzMzkxNzUzOH0.WNqPkCD2FB9mIUaMVKZLqN9q7wxFkHQKBA_YfTWPlUg";

// Initialize Supabase client for citizen auth
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

type UserType = {
  id: string;
  username: string;
  role: string;
  role_id?: number;
};

type CitizenUserType = {
  id: string;
  supabaseUserId: string;
  email: string;
  fullName: string;
  isProfileComplete: boolean;
  cnic?: string;
  contact?: string;
  address?: string;
};

type AuthContextType = {
  // Admin/Police auth state
  user: UserType | null;
  token: string | null;
  login: (username: string, password: string, verify_role: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  isAuthenticated: boolean;

  // Citizen auth state (Supabase)
  citizen: CitizenUserType | null;
  citizenToken: string | null;
  citizenSession: any;
  isCitizenAuthenticated: boolean;
  citizenLogin: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  citizenRegister: (email: string, password: string, fullName: string) => Promise<{ success: boolean; message?: string }>;
  citizenGoogleLogin: () => Promise<{ success: boolean; message?: string }>;
  citizenLogout: () => Promise<void>;
  refreshCitizenSession: () => Promise<void>;
  updateCitizenProfile: (data: { cnic?: string; contact?: string; address?: string }) => Promise<{ success: boolean; message?: string }>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Admin/Police auth state
  const [user, setUser] = useState<UserType | null>(() => {
    try {
      const s = localStorage.getItem("user");
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));

  // Citizen auth state (Supabase)
  const [citizen, setCitizen] = useState<CitizenUserType | null>(() => {
    try {
      const c = localStorage.getItem("citizen");
      return c ? JSON.parse(c) : null;
    } catch {
      return null;
    }
  });

  const [citizenToken, setCitizenToken] = useState<string | null>(() => localStorage.getItem("citizen_token"));
  const [citizenSession, setCitizenSession] = useState<any>(() => {
    try {
      const s = localStorage.getItem("citizen_session");
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    // Ensure axios has token header on start if present
    if (token) setAuthToken(token);

    // Initialize Supabase session from storage
    const initSupabaseSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setCitizenSession(session);
        setCitizenToken(session.access_token);
        localStorage.setItem("citizen_token", session.access_token);
        localStorage.setItem("citizen_session", JSON.stringify(session));
      }
    };

    initSupabaseSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setCitizenSession(session);
        setCitizenToken(session.access_token);
        localStorage.setItem("citizen_token", session.access_token);
        localStorage.setItem("citizen_session", JSON.stringify(session));
      } else if (event === 'SIGNED_OUT') {
        setCitizenSession(null);
        setCitizenToken(null);
        setCitizen(null);
        localStorage.removeItem("citizen_token");
        localStorage.removeItem("citizen_session");
        localStorage.removeItem("citizen");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [token]);

  /**
   * Admin/Police login (JWT-based)
   */
  const login = async (username: string, password: string, verify_role: string) => {
    try {
      const data = await loginUser(username, password, verify_role);
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

  /**
   * Logout (Admin/Police)
   */
  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setAuthToken(null);
    setToken(null);
    setUser(null);
  };

  /**
   * Citizen login (Supabase)
   */
  const citizenLogin = async (email: string, password: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/citizens/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, message: data.error || "Login failed" };
      }

      setCitizen(data.user);
      setCitizenSession(data.session);
      setCitizenToken(data.session.access_token);
      localStorage.setItem("citizen", JSON.stringify(data.user));
      localStorage.setItem("citizen_session", JSON.stringify(data.session));
      localStorage.setItem("citizen_token", data.session.access_token);

      return { success: true };
    } catch (err: any) {
      return { success: false, message: "Login failed. Please try again." };
    }
  };

  /**
   * Citizen registration (Supabase)
   */
  const citizenRegister = async (email: string, password: string, fullName: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/citizens/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, fullName }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, message: data.error || "Registration failed" };
      }

      setCitizen(data.user);
      setCitizenSession(data.session);
      setCitizenToken(data.session.access_token);
      localStorage.setItem("citizen", JSON.stringify(data.user));
      localStorage.setItem("citizen_session", JSON.stringify(data.session));
      localStorage.setItem("citizen_token", data.session.access_token);

      return { success: true };
    } catch (err: any) {
      return { success: false, message: "Registration failed. Please try again." };
    }
  };

  /**
   * Citizen Google OAuth login
   */
  const citizenGoogleLogin = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        return { success: false, message: error.message };
      }

      // Supabase will redirect to Google OAuth page
      return { success: true };
    } catch (err: any) {
      return { success: false, message: "Google login failed. Please try again." };
    }
  };

  /**
   * Citizen logout
   */
  const citizenLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/citizens/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${citizenToken}`,
        },
      });
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      setCitizen(null);
      setCitizenSession(null);
      setCitizenToken(null);
      localStorage.removeItem("citizen");
      localStorage.removeItem("citizen_session");
      localStorage.removeItem("citizen_token");
    }
  };

  /**
   * Refresh citizen session
   */
  const refreshCitizenSession = async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) throw error;

      setCitizenSession(data.session);
      setCitizenToken(data.session.access_token);
      localStorage.setItem("citizen_session", JSON.stringify(data.session));
      localStorage.setItem("citizen_token", data.session.access_token);
    } catch (err) {
      console.error("Session refresh failed:", err);
      await citizenLogout();
    }
  };

  /**
   * Update citizen profile
   */
  const updateCitizenProfile = async (profileData: { cnic?: string; contact?: string; address?: string }) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/citizens/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${citizenToken}`,
        },
        body: JSON.stringify(profileData),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, message: data.error || "Profile update failed" };
      }

      // Update local citizen state
      setCitizen(data.profile);
      localStorage.setItem("citizen", JSON.stringify(data.profile));

      return { success: true };
    } catch (err: any) {
      return { success: false, message: "Profile update failed. Please try again." };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        // Admin/Police
        user,
        token,
        login,
        logout,
        isAuthenticated: !!token,

        // Citizen
        citizen,
        citizenToken,
        citizenSession,
        isCitizenAuthenticated: !!citizen,
        citizenLogin,
        citizenRegister,
        citizenGoogleLogin,
        citizenLogout,
        refreshCitizenSession,
        updateCitizenProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
