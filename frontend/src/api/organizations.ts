/* eslint-disable @typescript-eslint/no-explicit-any */
// src/api/organizations.ts
import apiClient from "./client";
import type {
  Department,
  DepartmentTree,
  CreateDepartmentRequest,
  UpdateDepartmentRequest,
} from "../types/organizations.types";

export const organizationsApi = {
  // Departments
  getDepartments: async (params?: any) => {
    const response = await apiClient.get<{ results: Department[] }>(
      "/organizations/departments/",
      { params },
    );
    return response.data;
  },

  getDepartment: async (id: string) => {
    const response = await apiClient.get<Department>(
      `/organizations/departments/${id}/`,
    );
    return response.data;
  },

  createDepartment: async (data: CreateDepartmentRequest) => {
    const response = await apiClient.post<Department>(
      "/organizations/departments/",
      data,
    );
    return response.data;
  },

  updateDepartment: async (id: string, data: UpdateDepartmentRequest) => {
    const response = await apiClient.patch<Department>(
      `/organizations/departments/${id}/`,
      data,
    );
    return response.data;
  },

  deleteDepartment: async (id: string) => {
    await apiClient.delete(`/organizations/departments/${id}/`);
  },

  getDepartmentTree: async () => {
    const response = await apiClient.get<DepartmentTree[]>(
      "/organizations/departments/tree/",
    );
    return response.data;
  },

  getDepartmentChildren: async (departmentId: string) => {
    const response = await apiClient.get<Department[]>(
      `/organizations/departments/${departmentId}/children/`,
    );
    return response.data;
  },
};
