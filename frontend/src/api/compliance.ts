import apiClient from "./client";
import type {
  ComplianceResult,
  ComplianceOverview,
  FrameworkAdoption,
} from "../types/compliance.types";

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export const complianceApi = {
  // Results
  getResults: async (params?: {
    page?: number;
    page_size?: number;
    framework?: string;
    department?: string;
    is_current?: boolean;
  }) => {
    const response = await apiClient.get<PaginatedResponse<ComplianceResult>>(
      "/compliance/results/",
      { params },
    );
    return response.data;
  },

  getResult: async (id: string) => {
    const response = await apiClient.get<ComplianceResult>(
      `/compliance/results/${id}/`,
    );
    return response.data;
  },

  getCurrentResults: async () => {
    const response = await apiClient.get<ComplianceResult[]>(
      "/compliance/results/current/",
    );
    return response.data;
  },

  getOverview: async () => {
    const response = await apiClient.get<ComplianceOverview>(
      "/compliance/results/overview/",
    );
    return response.data;
  },

  getTrends: async (frameworkId: string, months = 12) => {
    const response = await apiClient.get("/compliance/results/trends/", {
      params: { framework: frameworkId, months },
    });
    return response.data;
  },

  getGapAnalysis: async (frameworkId: string) => {
    const response = await apiClient.get("/compliance/results/gap_analysis/", {
      params: { framework: frameworkId },
    });
    return response.data;
  },

  getRecommendations: async (frameworkId: string) => {
    const response = await apiClient.get(
      "/compliance/results/recommendations/",
      {
        params: { framework: frameworkId },
      },
    );
    return response.data;
  },

  calculate: async (frameworkId: string, departmentId?: string) => {
    const response = await apiClient.post<ComplianceResult>(
      "/compliance/results/calculate/",
      {
        framework: frameworkId,
        department: departmentId,
      },
    );
    return response.data;
  },

  calculateAll: async () => {
    const response = await apiClient.post("/compliance/results/calculate_all/");
    return response.data;
  },

  // Gaps
  getGaps: async (params?: {
    page?: number;
    compliance_result?: string;
    severity?: string;
    status?: string;
  }) => {
    const response = await apiClient.get("/compliance/gaps/", { params });
    return response.data;
  },

  resolveGap: async (id: string, notes?: string) => {
    const response = await apiClient.post(`/compliance/gaps/${id}/resolve/`, {
      notes,
    });
    return response.data;
  },

  acceptRisk: async (id: string) => {
    const response = await apiClient.post(
      `/compliance/gaps/${id}/accept_risk/`,
    );
    return response.data;
  },

  getOpenGaps: async () => {
    const response = await apiClient.get("/compliance/gaps/open/");
    return response.data;
  },

  getOverdueGaps: async () => {
    const response = await apiClient.get("/compliance/gaps/overdue/");
    return response.data;
  },

  // Framework Adoptions
  getAdoptions: async (params?: {
    page?: number;
    adoption_status?: string;
    is_certified?: boolean;
  }) => {
    const response = await apiClient.get<PaginatedResponse<FrameworkAdoption>>(
      "/compliance/adoptions/",
      { params },
    );
    return response.data;
  },

  getAdoption: async (id: string) => {
    const response = await apiClient.get<FrameworkAdoption>(
      `/compliance/adoptions/${id}/`,
    );
    return response.data;
  },

  adoptFramework: async (data: {
    framework: string;
    target_completion_date?: string;
    scope_description?: string;
  }) => {
    const response = await apiClient.post<FrameworkAdoption>(
      "/compliance/adoptions/adopt_framework/",
      data,
    );
    return response.data;
  },

  updateAdoption: async (id: string, data: Partial<FrameworkAdoption>) => {
    const response = await apiClient.patch<FrameworkAdoption>(
      `/compliance/adoptions/${id}/`,
      data,
    );
    return response.data;
  },

  certifyFramework: async (
    id: string,
    data: {
      certification_date?: string;
      certification_body?: string;
      certification_expiry_date?: string;
      certificate_number?: string;
    },
  ) => {
    const response = await apiClient.post(
      `/compliance/adoptions/${id}/certify/`,
      data,
    );
    return response.data;
  },

  getActiveAdoptions: async () => {
    const response = await apiClient.get<FrameworkAdoption[]>(
      "/compliance/adoptions/active/",
    );
    return response.data;
  },

  getCertifiedFrameworks: async () => {
    const response = await apiClient.get<FrameworkAdoption[]>(
      "/compliance/adoptions/certified/",
    );
    return response.data;
  },

  getExpiringSoon: async () => {
    const response = await apiClient.get<FrameworkAdoption[]>(
      "/compliance/adoptions/expiring_soon/",
    );
    return response.data;
  },

  // Reports
  generateReport: async (data: {
    title: string;
    framework?: string;
    department?: string;
    report_type: string;
    report_format?: string;
    period_start?: string;
    period_end?: string;
  }) => {
    const response = await apiClient.post(
      "/compliance/reports/generate/",
      data,
    );
    return response.data;
  },

  getReports: async () => {
    const response = await apiClient.get("/compliance/reports/");
    return response.data;
  },

  downloadReport: async (id: string) => {
    const response = await apiClient.get(
      `/compliance/reports/${id}/download/`,
      {
        responseType: "blob",
      },
    );
    return response.data;
  },

  // Library Frameworks (for dropdown selects)
  getFrameworks: async () => {
    const response = await apiClient.get("/library/frameworks/", {
      params: { is_published: true, page_size: 100 },
    });
    return response.data;
  },
};
