import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useAuth, type AuthUser } from "@workspace/replit-auth-web";

export type UserRole = "admin" | "contributor" | "viewer" | "requester";

export type Permission = "view" | "contribute" | "createRequest" | "admin";

const PERMISSION_ROLES: Record<Permission, readonly UserRole[]> = {
  view: ["admin", "contributor", "viewer"],
  contribute: ["admin", "contributor"],
  createRequest: ["admin", "contributor", "requester"],
  admin: ["admin"],
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  contributor: "Contributor",
  viewer: "Viewer",
  requester: "Requester",
};

interface AuthContextValue {
  user: AuthUser | null;
  role: UserRole | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
  can: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user, isLoading, isAuthenticated, login, logout } = useAuth();

  const value = useMemo<AuthContextValue>(() => {
    const role = (user?.role as UserRole | undefined) ?? null;
    const can = (permission: Permission): boolean =>
      role !== null && PERMISSION_ROLES[permission].includes(role);
    return { user, role, isLoading, isAuthenticated, login, logout, can };
  }, [user, isLoading, isAuthenticated, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return ctx;
}
