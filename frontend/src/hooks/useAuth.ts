/* eslint-disable @typescript-eslint/no-unused-vars */
import { useAuthStore } from "../stores/authStore";
import { authApi } from "../api/auth";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { LoginRequest, RegisterRequest } from "../types/auth.types";

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
      // Perform both operations in mutationFn so errors propagate correctly
      const tokens = await authApi.login(credentials);
      setAuth(null, tokens.access, tokens.refresh); // Temporarily set tokens to allow authApi.getCurrentUser() to work
      const currentUser = await authApi.getCurrentUser();
      return { tokens, currentUser };
    },
    onSuccess: ({ tokens, currentUser }) => {
      // Set auth state
      setAuth(currentUser, tokens.access, tokens.refresh);

      // Navigate to company selection
      navigate("/select-company");
    },
  });

  // REGISTER (auto-login after registration)
  // Register mutation
  const registerMutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: () => {
      // After successful registration, redirect to login
      navigate("/login");
    },
  });

  // Logout function
  const logoutUser = async () => {
    try {
      // Try to blacklist the refresh token
      const { refreshToken } = useAuthStore.getState();
      if (refreshToken) {
        await authApi.logout(refreshToken);
      }
    } catch (error) {
      // Ignore errors during logout
      console.error("Logout error:", error);
    } finally {
      // Always clear local state and redirect
      logoutStore();
      navigate("/login");
    }
  };

  return {
    ...useAuthStore(),
    login: loginMutation.mutate,
    register: registerMutation.mutate,
    logout: logoutUser,
    isLoading: loginMutation.isPending || registerMutation.isPending,
    error: loginMutation.error || registerMutation.error,
  };
}
