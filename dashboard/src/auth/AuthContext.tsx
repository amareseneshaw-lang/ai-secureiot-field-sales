import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { crmApi, type AuthUser } from "../api/client";
import { clearStoredToken, getStoredToken, isTokenExpired, setStoredToken } from "./tokenStorage";

const USER_STORAGE_KEY = "secureiot_auth_user";

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

function initialUser(): AuthUser | null {
  const token = getStoredToken();
  if (!token || isTokenExpired(token)) {
    clearStoredToken();
    localStorage.removeItem(USER_STORAGE_KEY);
    return null;
  }
  return readStoredUser();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(initialUser);

  useEffect(() => {
    const handleUnauthorized = () => {
      clearStoredToken();
      localStorage.removeItem(USER_STORAGE_KEY);
      setUser(null);
    };
    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", handleUnauthorized);
  }, []);

  const login = async (username: string, password: string) => {
    const response = await crmApi.login(username, password);
    setStoredToken(response.access_token);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(response.user));
    setUser(response.user);
  };

  const logout = () => {
    clearStoredToken();
    localStorage.removeItem(USER_STORAGE_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: user !== null, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
