import apiClient from "./client";
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  User,
  Company,
  PaginatedResponse,
  Membership,
} from "../types/auth.types";

export const authApi = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>(
      "/auth/token/",
      credentials,
    );
    return response.data;
  },

  logout: async (refreshToken: string): Promise<void> => {
    await apiClient.post("/auth/logout/", { refresh: refreshToken });
  },

  register: async (data: RegisterRequest): Promise<User> => {
    console.log("Registering user with data:", data);
    const response = await apiClient.post<User>("/auth/register/", data);
    console.log("Registration response:", response.data);
    return response.data;
  },

  refreshToken: async (refresh: string): Promise<{ access: string }> => {
    const response = await apiClient.post("/auth/token/refresh/", {
      refresh,
    });
    return response.data;
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await apiClient.get<User>("/auth/me/");
    return response.data;
  },

  getCompanies: async (): Promise<Company[]> => {
    const response =
      await apiClient.get<PaginatedResponse<Company>>("/companies/");
    return response.data.results;
  },

  getMemberships: async (companyId: string): Promise<Membership[]> => {
    const response = await apiClient.get<PaginatedResponse<Membership>>(
      "/memberships/",
      { params: { company: companyId } },
    );

    return response.data.results;
  },

  createCompany: async (name: string): Promise<Company> => {
    const response = await apiClient.post<Company>(
      "/companies/create_with_membership/",
      { name },
    );
    return response.data;
  },
};
