// src/hooks/useAuth.ts
import { useAuthStore } from "@/stores/authStore";
import { authApi } from "@/api/auth";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { LoginRequest } from "@/types/auth.types";

export function useAuth() {
  const navigate = useNavigate();
  const {
    user,
    company,
    membership,
    isAuthenticated,
    setAuth,
    setCompany,
    logout: logoutStore,
  } = useAuthStore();

  // ── Login ─────────────────────────────────────────────────────────────────
  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginRequest) => {
      const loginResponse = await authApi.login(credentials);
      // Set tokens early so subsequent authenticated requests work
      setAuth(null, loginResponse.access, loginResponse.refresh);

      const [currentUser, companies] = await Promise.all([
        authApi.getCurrentUser(),
        authApi.getCompanies(),
      ]);

      return { tokens: loginResponse, user: currentUser, companies };
    },
    onSuccess: async ({ tokens, user, companies }) => {
      setAuth(user, tokens.access, tokens.refresh);

      if (companies.length === 0) {
        navigate("/select-company");
      } else if (companies.length === 1) {
        // Auto-select the only company
        try {
          const membershipsResponse = await authApi.getMemberships({
            company: companies[0].id,
          });
          const mem = membershipsResponse.results[0];
          if (!mem) throw new Error("No membership");
          setCompany(companies[0], mem);
          navigate("/dashboard");
        } catch {
          // Membership fetch failed — let user pick manually
          navigate("/select-company");
        }
      } else {
        navigate("/select-company");
      }
    },
    onError: (error) => {
      console.error("Login failed:", error);
    },
  });

  // ── Register ──────────────────────────────────────────────────────────────
  const registerMutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: () => navigate("/login"),
    onError: (error) => console.error("Registration failed:", error),
  });

  // ── Logout ────────────────────────────────────────────────────────────────
  const logoutUser = async () => {
    try {
      const { refreshToken } = useAuthStore.getState();
      if (refreshToken) await authApi.logout(refreshToken);
    } catch {
      // Non-fatal — always clear local state
    } finally {
      logoutStore();
      navigate("/login");
    }
  };

  return {
    user,
    company,
    membership,
    isAuthenticated,
    login: loginMutation.mutate,
    register: registerMutation.mutate,
    logout: logoutUser,
    isLoading: loginMutation.isPending || registerMutation.isPending,
    error: loginMutation.error || registerMutation.error,
  };
}
