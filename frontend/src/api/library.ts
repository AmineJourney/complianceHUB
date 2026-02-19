/* eslint-disable @typescript-eslint/no-explicit-any */
// src/api/library.ts
import apiClient from "./client";
import type {
  ComplianceFramework,
  FrameworkRequirement,
  FrameworkRequirementTree,
  ControlMapping,
  FrameworkStatistics,
} from "../types/library.types";

export const libraryApi = {
  // Frameworks
  getFrameworks: async (params?: any) => {
    const response = await apiClient.get<{ results: ComplianceFramework[] }>(
      "/library/frameworks/",
      { params },
    );
    return response.data;
  },

  getFramework: async (id: string) => {
    const response = await apiClient.get<ComplianceFramework>(
      `/library/frameworks/${id}/`,
    );
    return response.data;
  },

  getFrameworkRequirements: async (frameworkId: string) => {
    const response = await apiClient.get<FrameworkRequirement[]>(
      `/library/frameworks/${frameworkId}/requirements/`,
    );
    return response.data;
  },

  getFrameworkRequirementsTree: async (frameworkId: string) => {
    const response = await apiClient.get<FrameworkRequirementTree[]>(
      `/library/frameworks/${frameworkId}/requirements_tree/`,
    );
    return response.data;
  },

  getFrameworkStatistics: async (frameworkId: string) => {
    const response = await apiClient.get<FrameworkStatistics>(
      `/library/frameworks/${frameworkId}/statistics/`,
    );
    return response.data;
  },

  // Requirements
  getRequirements: async (params?: any) => {
    const response = await apiClient.get<{ results: FrameworkRequirement[] }>(
      "/library/requirements/",
      { params },
    );
    return response.data;
  },

  getRequirement: async (id: string) => {
    const response = await apiClient.get<FrameworkRequirement>(
      `/library/requirements/${id}/`,
    );
    return response.data;
  },

  getRequirementControlMappings: async (requirementId: string) => {
    const response = await apiClient.get<ControlMapping[]>(
      `/library/requirements/${requirementId}/control_mappings/`,
    );
    return response.data;
  },

  getRequirementChildren: async (requirementId: string) => {
    const response = await apiClient.get<FrameworkRequirement[]>(
      `/library/requirements/${requirementId}/children/`,
    );
    return response.data;
  },

  // Control Mappings
  getControlMappings: async (params?: any) => {
    const response = await apiClient.get<{ results: ControlMapping[] }>(
      "/library/mappings/",
      { params },
    );
    return response.data;
  },
};
