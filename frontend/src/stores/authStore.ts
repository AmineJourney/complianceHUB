import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, Company, Membership, AuthState } from "../types/auth.types";

interface AuthStore extends AuthState {
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  setCompany: (company: Company, membership: Membership) => void;
  setAccessToken: (token: string) => void;
  logout: () => void;
  isOwnerOrAdmin: () => boolean;
  hasPermission: (permission: string) => boolean;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      company: null,
      membership: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setAuth: (user, accessToken, refreshToken) => {
        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
        });
      },

      setCompany: (company, membership) => {
        set({ company, membership });
      },

      setAccessToken: (token) => {
        set({ accessToken: token });
      },

      logout: () => {
        set({
          user: null,
          company: null,
          membership: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        });
      },

      isOwnerOrAdmin: () => {
        const { membership } = get();
        return membership?.role === "owner" || membership?.role === "admin";
      },

      hasPermission: (permission: string) => {
        const { membership } = get();
        if (!membership) return false;

        const rolePermissions: Record<string, string[]> = {
          owner: ["*"],
          admin: [
            "view_any",
            "create_any",
            "update_any",
            "delete_any",
            "manage_users",
          ],
          manager: ["view_any", "create_any", "update_own", "delete_own"],
          analyst: ["view_any", "create_evidence", "update_own"],
          auditor: ["view_any", "export_reports"],
          viewer: ["view_own", "view_assigned"],
        };

        const perms = rolePermissions[membership.role] || [];
        return perms.includes("*") || perms.includes(permission);
      },
    }),
    {
      name: "auth-storage",
    },
  ),
);
