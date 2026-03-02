import apiClient from "./client";
import type { AuditLog, AuditSummary } from "../types/audit.types";

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export const auditApi = {
  getLogs: async (params?: {
    page?: number;
    page_size?: number;
    search?: string;
    action?: string;
    resource_type?: string;
    actor_email?: string;
    date_from?: string;
    date_to?: string;
  }) => {
    const response = await apiClient.get<PaginatedResponse<AuditLog>>(
      "/audit/logs/",
      { params },
    );
    return response.data;
  },

  getLog: async (id: string) => {
    const response = await apiClient.get<AuditLog>(`/audit/logs/${id}/`);
    return response.data;
  },

  getSummary: async () => {
    const response = await apiClient.get<AuditSummary>("/audit/logs/summary/");
    return response.data;
  },

  getExportUrl: () => {
    // Returns the URL; caller opens it directly for download
    return "/api/audit/logs/export_csv/";
  },
};
