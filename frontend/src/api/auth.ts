// src/api/auth.ts
import apiClient from "./client";
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  User,
  Company,
  Membership,
} from "@/types/auth.types";

export const authApi = {
  // ── Auth ──────────────────────────────────────────────────────────────────

  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>(
      "/auth/token/",
      credentials,
    );
    return response.data;
  },

  register: async (data: RegisterRequest): Promise<User> => {
    const response = await apiClient.post<User>("/auth/register/", data);
    return response.data;
  },

  refreshToken: async (refresh: string): Promise<{ access: string }> => {
    const response = await apiClient.post("/auth/token/refresh/", { refresh });
    return response.data;
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await apiClient.get<User>("/auth/me/");
    return response.data;
  },

  logout: async (refreshToken: string): Promise<void> => {
    await apiClient.post("/auth/logout/", { refresh: refreshToken });
  },

  // ── Company / membership ──────────────────────────────────────────────────

  getCompanies: async (): Promise<Company[]> => {
    const response = await apiClient.get<{ count: number; results: Company[] }>(
      "/companies/",
    );
    return response.data.results;
  },

  getMemberships: async (params?: {
    company?: string;
  }): Promise<{ results: Membership[] }> => {
    const response = await apiClient.get<{ results: Membership[] }>(
      "/memberships/",
      { params },
    );
    return response.data;
  },

  createCompany: async (name: string): Promise<Company> => {
    const response = await apiClient.post<Company>(
      "/companies/create_with_membership/",
      { name },
    );
    return response.data;
  },

  // ── Password reset ────────────────────────────────────────────────────────

  /**
   * POST /api/auth/password-reset/
   * Always returns 200.
   * In DEBUG mode the backend also returns `reset_link` — shown on-screen.
   */
  requestPasswordReset: async (
    email: string,
  ): Promise<{
    message: string;
    reset_link?: string; // only present when DEBUG=True
    expires_in_minutes?: number;
  }> => {
    const response = await apiClient.post("/auth/password-reset/", { email });
    return response.data;
  },

  /**
   * GET /api/auth/password-reset/validate/?token=<token>
   * Returns { valid: boolean } — lets the ResetPassword page show an
   * error immediately if the link is already expired/used.
   */
  validateResetToken: async (token: string): Promise<{ valid: boolean }> => {
    const response = await apiClient.get(
      `/auth/password-reset/validate/?token=${token}`,
    );
    return response.data;
  },

  /**
   * POST /api/auth/password-reset/confirm/
   */
  confirmPasswordReset: async (data: {
    token: string;
    new_password: string;
    new_password_confirm: string;
  }): Promise<{ message: string }> => {
    const response = await apiClient.post(
      "/auth/password-reset/confirm/",
      data,
    );
    return response.data;
  },
};
