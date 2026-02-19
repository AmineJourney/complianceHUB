// src/hooks/useAuth.ts - REFACTORED VERSION
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

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginRequest) => {
      // 1. Get tokens
      const loginResponse = await authApi.login(credentials);

      // 2. Temporarily set tokens so authenticated requests work
      setAuth(null, loginResponse.access, loginResponse.refresh);

      // 3. Fetch current user details
      const currentUser = await authApi.getCurrentUser();

      // 4. Fetch user's companies
      const companies = await authApi.getCompanies();
      console.log("User's companies:", companies);

      return {
        tokens: {
          access: loginResponse.access,
          refresh: loginResponse.refresh,
        },
        user: currentUser,
        companies,
      };
    },
    onSuccess: ({ tokens, user, companies }) => {
      // Set auth with complete user data
      setAuth(user, tokens.access, tokens.refresh);

      // Handle company selection
      if (companies.length === 0) {
        // No companies - redirect to create company
        navigate("/create-company");
      } else if (companies.length === 1) {
        // Single company - auto-select it
        const singleCompany = companies[0];
        handleAutoSelectCompany(singleCompany.id);
      } else {
        // Multiple companies - show selector
        navigate("/select-company");
      }
    },
    onError: (error) => {
      console.error("Login failed:", error);
    },
  });

  // Auto-select company for single-company users
  const handleAutoSelectCompany = async (companyId: string) => {
    try {
      // Fetch full company details
      const companies = await authApi.getCompanies();
      const selectedCompany = companies.find((c) => c.id === companyId);

      if (!selectedCompany) {
        throw new Error("Company not found");
      }

      // Fetch membership for this company
      const memberships = await authApi.getMemberships({ company: companyId });

      if (memberships.results.length === 0) {
        throw new Error("No membership found for company");
      }

      const userMembership = memberships.results[0];

      // Set company and membership in store
      setCompany(selectedCompany, userMembership);

      // Navigate to dashboard
      navigate("/dashboard");
    } catch (error) {
      console.error("Auto-select company failed:", error);
      // Fallback to company selector
      navigate("/select-company");
    }
  };

  // Register mutation
  const registerMutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: () => {
      // Redirect to login after successful registration
      navigate("/login");
    },
    onError: (error) => {
      console.error("Registration failed:", error);
    },
  });

  // Logout function
  const logoutUser = async () => {
    try {
      const { refreshToken } = useAuthStore.getState();

      if (refreshToken) {
        // Attempt to blacklist the refresh token on backend
        await authApi.logout(refreshToken);
      }
    } catch (error) {
      // Log error but don't prevent logout
      console.error("Logout API call failed:", error);
    } finally {
      // Always clear local state
      logoutStore();
      navigate("/login");
    }
  };

  return {
    // State
    user,
    company,
    membership,
    isAuthenticated,

    // Actions
    login: loginMutation.mutate,
    register: registerMutation.mutate,
    logout: logoutUser,

    // Status
    isLoading: loginMutation.isPending || registerMutation.isPending,
    error: loginMutation.error || registerMutation.error,
  };
}
