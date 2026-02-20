// src/api/profile.ts
import apiClient from "./client";
import type {
  User,
  UpdateProfileRequest,
  ChangePasswordRequest,
} from "@/types/auth.types";

export const profileApi = {
  // Get current user profile
  getProfile: async (): Promise<User> => {
    const response = await apiClient.get<User>("/auth/me/");
    return response.data;
  },

  // Update user profile
  updateProfile: async (data: UpdateProfileRequest): Promise<User> => {
    const response = await apiClient.patch<User>("/auth/me/", data);
    return response.data;
  },

  // Change password
  changePassword: async (data: ChangePasswordRequest): Promise<void> => {
    await apiClient.post("/auth/change-password/", data);
  },

  // Delete account
  deleteAccount: async (password: string): Promise<void> => {
    await apiClient.post("/auth/delete-account/", { password });
  },
};
