import { useAuthStore } from "../stores/authStore";
import { authApi } from "../api/auth";
import { useMutation, useQuery } from "@tanstack/react-query";
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
    logout,
  } = useAuthStore();

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      const { access, refresh, companies, company_id } = data;

      // If user has only one company, auto-select it
      if (companies.length === 1) {
        // We'll need to fetch full user data
        authApi.getCurrentUser().then((user) => {
          setAuth(user, access, refresh);
          // Navigate to company selector or dashboard
          navigate("/select-company");
        });
      } else {
        authApi.getCurrentUser().then((user) => {
          setAuth(user, access, refresh);
          navigate("/select-company");
        });
      }
    },
  });

  const registerMutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: () => {
      navigate("/login");
    },
  });

  const logoutUser = () => {
    logout();
    navigate("/login");
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
