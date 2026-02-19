import apiClient from "./client";
import type {
  AppliedControl,
  ReferenceControl,
  ControlDashboard,
} from "../types/control.types";

export const controlsApi = {
  // Reference Controls
  getReferenceControls: async (params?: unknown) => {
    const response = await apiClient.get<{ results: ReferenceControl[] }>(
      "/controls/reference-controls/",
      { params },
    );
    return response.data;
  },

  getReferenceControl: async (id: string) => {
    const response = await apiClient.get<ReferenceControl>(
      `/controls/reference-controls/${id}/`,
    );
    return response.data;
  },

  // Applied Controls
  getAppliedControls: async (params?: unknown) => {
    const response = await apiClient.get<{ results: AppliedControl[] }>(
      "/controls/applied-controls/",
      { params },
    );
    return response.data;
  },

  getAppliedControl: async (id: string) => {
    const response = await apiClient.get<AppliedControl>(
      `/controls/applied-controls/${id}/`,
    );
    return response.data;
  },

  createAppliedControl: async (data: Partial<AppliedControl>) => {
    const response = await apiClient.post<AppliedControl>(
      "/controls/applied-controls/",
      data,
    );
    return response.data;
  },

  updateAppliedControl: async (id: string, data: Partial<AppliedControl>) => {
    const response = await apiClient.patch<AppliedControl>(
      `/controls/applied-controls/${id}/`,
      data,
    );
    return response.data;
  },

  deleteAppliedControl: async (id: string) => {
    await apiClient.delete(`/controls/applied-controls/${id}/`);
  },

  applyControl: async (data: {
    reference_control: string;
    department?: string;
    control_owner?: string;
  }) => {
    const response = await apiClient.post<AppliedControl>(
      "/controls/applied-controls/apply_control/",
      data,
    );
    return response.data;
  },

  applyFrameworkControls: async (data: {
    framework: string;
    department?: string;
  }) => {
    const response = await apiClient.post(
      "/controls/applied-controls/apply_framework_controls/",
      data,
    );
    return response.data;
  },

  getControlDashboard: async () => {
    const response = await apiClient.get<ControlDashboard>(
      "/controls/applied-controls/dashboard/",
    );
    return response.data;
  },

  getOverdueReviews: async () => {
    const response = await apiClient.get<AppliedControl[]>(
      "/controls/applied-controls/overdue_reviews/",
    );
    return response.data;
  },
};
