import apiClient from "./client";
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  User,
  Company,
} from "../types/auth.types";

export const authApi = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>(
      "/core/auth/token/",
      credentials,
    );
    return response.data;
  },

  register: async (data: RegisterRequest): Promise<User> => {
    const response = await apiClient.post<User>("/core/users/register/", data);
    return response.data;
  },

  refreshToken: async (refresh: string): Promise<{ access: string }> => {
    const response = await apiClient.post("/core/auth/token/refresh/", {
      refresh,
    });
    return response.data;
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await apiClient.get<User>("/core/users/me/");
    return response.data;
  },

  getCompanies: async (): Promise<Company[]> => {
    const response = await apiClient.get<Company[]>("/core/companies/");
    return response.data;
  },

  createCompany: async (name: string): Promise<Company> => {
    const response = await apiClient.post<Company>(
      "/core/companies/create_with_membership/",
      { name },
    );
    return response.data;
  },
};
