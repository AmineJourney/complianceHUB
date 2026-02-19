// src/api/auth.ts - UPDATED VERSION
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
  // Login - returns JWT tokens and user's companies
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>(
      "/auth/token/",
      credentials,
    );
    return response.data;
  },

  // Register new user
  register: async (data: RegisterRequest): Promise<User> => {
    const response = await apiClient.post<User>("/auth/register/", data);
    return response.data;
  },

  // Refresh access token
  refreshToken: async (refresh: string): Promise<{ access: string }> => {
    const response = await apiClient.post("/auth/token/refresh/", { refresh });
    return response.data;
  },

  // Get current user details
  getCurrentUser: async (): Promise<User> => {
    const response = await apiClient.get<User>("/auth/me/");
    return response.data;
  },

  // Get user's companies
  getCompanies: async (): Promise<Company[]> => {
    const response = await apiClient.get<{
      count: number;
      results: Company[];
    }>("/companies/");

    return response.data.results;
  },

  // Get memberships - with optional filter by company
  getMemberships: async (params?: {
    company?: string;
  }): Promise<{ results: Membership[] }> => {
    const response = await apiClient.get<{ results: Membership[] }>(
      "/memberships/",
      { params },
    );
    return response.data;
  },

  // Create company (with automatic owner membership)
  createCompany: async (name: string): Promise<Company> => {
    const response = await apiClient.post<Company>(
      "/companies/create_with_membership/",
      { name },
    );
    return response.data;
  },

  // Logout - blacklist refresh token
  logout: async (refreshToken: string): Promise<void> => {
    await apiClient.post("/auth/logout/", { refresh: refreshToken });
  },
};
