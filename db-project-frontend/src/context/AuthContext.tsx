// src/context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { loginUser, setAuthToken } from "../services/api";
import { API_BASE_URL } from "../config/constants";

// Type definition for custom citizen update event
declare global {
  interface WindowEventMap {
    'citizen-updated': CustomEvent<any>;
  }
}

// Supabase configuration
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
}

// Initialize Supabase client for citizen auth
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    storage: window.localStorage,
  },
});

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
  emailVerified: boolean;
  provider?: string;
  cnic?: string;
  contact?: string;
  address?: string;
};

type AuthContextType = {
  // Admin/Police auth state
  user: UserType | null;
  token: string | null;
  login: (username: string, password: string, verifyRole: string) => Promise<{ success: boolean; message?: string; user?: UserType }>;
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
  resendVerificationEmail: (email?: string) => Promise<{ success: boolean; message?: string }>;
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
        localStorage.setItem("userRole", "user");
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
        localStorage.setItem("userRole", "user");
        // Note: Google OAuth profile creation is handled by AuthCallback component
      } else if (event === 'SIGNED_OUT') {
        setCitizenSession(null);
        setCitizenToken(null);
        setCitizen(null);
        localStorage.removeItem("citizen_token");
        localStorage.removeItem("citizen_session");
        localStorage.removeItem("citizen");
        localStorage.removeItem("userRole");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [token]);

  // Listen for citizen profile updates from other components
  useEffect(() => {
    const handleCitizenUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<CitizenUserType>;
      const updatedCitizen = customEvent.detail;
      if (updatedCitizen) {
        setCitizen(updatedCitizen);
      }
    };

    // Add event listener
    window.addEventListener('citizen-updated', handleCitizenUpdate);

    // Cleanup
    return () => {
      window.removeEventListener('citizen-updated', handleCitizenUpdate);
    };
  }, []);

  /**
   * Admin/Police login (JWT-based)
   */
  const login = async (username: string, password: string, verifyRole: string) => {
    try {
      const data = await loginUser(username, password, verifyRole);
      if (!data || !data.success) {
        return { success: false, message: data?.message || "Login failed" };
      }

      const receivedToken = data.token;
      const receivedUser = data.user;

      // persist
      localStorage.setItem("token", receivedToken);
      localStorage.setItem("user", JSON.stringify(receivedUser));
      localStorage.setItem("userRole", receivedUser.role);
      setAuthToken(receivedToken);
      setToken(receivedToken);
      setUser(receivedUser);

      return { success: true, user: receivedUser };
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
    localStorage.removeItem("userRole");
    setAuthToken(null);
    setToken(null);
    setUser(null);
  };

  /**
   * Citizen login (Supabase)
   */
  const citizenLogin = async (email: string, password: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/citizens/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, message: data.error || "Login failed" };
      }

      if (!data.user) {
        console.error("No user data in response:", data);
        return { success: false, message: "Invalid response from server" };
      }

      if (!data.session) {
        console.error("No session data in response:", data);
        return { success: false, message: "No session returned from server" };
      }

      // Add email verification status from Supabase session
      const sessionData = data.session;
      const citizenWithVerification = {
        ...data.user,
        emailVerified: !!(sessionData.user?.email_confirmed_at),
        provider: sessionData.user?.app_metadata?.provider || "email",
      };

      setCitizen(citizenWithVerification);
      setCitizenSession(sessionData);
      setCitizenToken(sessionData.access_token);
      localStorage.setItem("citizen", JSON.stringify(citizenWithVerification));
      localStorage.setItem("citizen_session", JSON.stringify(sessionData));
      localStorage.setItem("citizen_token", sessionData.access_token);
      localStorage.setItem("userRole", "user");

      return { success: true };
    } catch (err: any) {
      console.error("Login error:", err);
      return { success: false, message: err?.message || "Login failed. Please try again." };
    }
  };

  /**
   * Citizen registration (Supabase)
   */
  const citizenRegister = async (email: string, password: string, fullName: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/citizens/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, fullName }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, message: data.error || "Registration failed" };
      }

      // For email signup, emailVerified is false until user clicks verification link
      // Google OAuth users have verified emails by default
      const citizenWithVerification = {
        ...data.user,
        emailVerified: !!(data.session?.user?.email_confirmed_at),
        provider: data.session?.user?.app_metadata?.provider || "email",
      };

      setCitizen(citizenWithVerification);

      // Only set session/token if it exists (email confirmation might be disabled)
      if (data.session) {
        setCitizenSession(data.session);
        setCitizenToken(data.session.access_token);
        localStorage.setItem("citizen_session", JSON.stringify(data.session));
        localStorage.setItem("citizen_token", data.session.access_token);
      }

      localStorage.setItem("citizen", JSON.stringify(citizenWithVerification));
      localStorage.setItem("userRole", "user");

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
      const { error } = await supabase.auth.signInWithOAuth({
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
      // Sign out from Supabase
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Supabase logout error:", err);
    } finally {
      // Always clear local state
      setCitizen(null);
      setCitizenSession(null);
      setCitizenToken(null);
      localStorage.removeItem("citizen");
      localStorage.removeItem("citizen_session");
      localStorage.removeItem("citizen_token");
      localStorage.removeItem("userRole");
    }
  };

  /**
   * Refresh citizen session
   */
  const refreshCitizenSession = async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) throw error;

      if (!data.session) {
        throw new Error("No session returned from refresh");
      }

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
   * Resend verification email
   * @param email - Optional email parameter (used when user is not logged in)
   */
  const resendVerificationEmail = async (email?: string) => {
    try {
      const targetEmail = email || citizen?.email || '';

      if (!targetEmail) {
        return { success: false, message: "No email address provided" };
      }

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: targetEmail,
      });

      if (error) {
        return { success: false, message: error.message || "Failed to resend verification email" };
      }

      return { success: true, message: "Verification email sent! Please check your inbox." };
    } catch (err: any) {
      console.error("Resend verification error:", err);
      return { success: false, message: "Failed to resend verification email. Please try again." };
    }
  };

  /**
   * Update citizen profile
   */
  const updateCitizenProfile = async (profileData: { cnic?: string; contact?: string; address?: string }) => {
    try {
      // Try to get a fresh token from Supabase first
      let token = citizenToken || localStorage.getItem("citizen_token");

      // If we have a Supabase session, try to get a fresh token
      if (citizenSession?.access_token) {
        token = citizenSession.access_token;
      } else {
        // Try to refresh from Supabase
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            token = session.access_token;
            // Update state with fresh token
            setCitizenToken(session.access_token);
            localStorage.setItem("citizen_token", session.access_token);
          }
        } catch (e) {
          console.error("Failed to get fresh session:", e);
        }
      }

      if (!token) {
        return { success: false, message: "Not authenticated. Please login again." };
      }

      const response = await fetch(`${API_BASE_URL}/citizens/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(profileData),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Profile update failed:", response.status, data);
        // Handle email not verified error specifically
        if (data.code === "EMAIL_NOT_VERIFIED" || data.error?.includes("verify your email")) {
          return { success: false, message: "Please verify your email first. Check your inbox for the verification link." };
        }
        return { success: false, message: data.error || data.message || "Profile update failed" };
      }

      // Update local citizen state with the returned user data
      setCitizen(data.user);
      localStorage.setItem("citizen", JSON.stringify(data.user));

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
        resendVerificationEmail,
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
