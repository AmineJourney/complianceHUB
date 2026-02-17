import apiClient from "./client";
import type {
  Risk,
  RiskMatrix,
  RiskAssessment,
  RiskEvent,
  RiskTreatmentAction,
} from "../types/risk.types";

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export const riskApi = {
  // Risk Matrices
  getRiskMatrices: async () => {
    const response =
      await apiClient.get<PaginatedResponse<RiskMatrix>>("/risk/matrices/");
    return response.data;
  },

  getRiskMatrix: async (id: string) => {
    const response = await apiClient.get<RiskMatrix>(`/risk/matrices/${id}/`);
    return response.data;
  },

  getActiveMatrix: async () => {
    const response = await apiClient.get<RiskMatrix>("/risk/matrices/active/");
    return response.data;
  },

  createDefaultMatrix: async () => {
    const response = await apiClient.post<RiskMatrix>(
      "/risk/matrices/create_default/",
    );
    return response.data;
  },

  activateMatrix: async (id: string) => {
    const response = await apiClient.post(`/risk/matrices/${id}/activate/`);
    return response.data;
  },

  // Risks
  getRisks: async (params?: {
    page?: number;
    page_size?: number;
    search?: string;
    risk_category?: string;
    inherent_risk_level?: string;
    status?: string;
    risk_owner?: string;
  }) => {
    const response = await apiClient.get<PaginatedResponse<Risk>>(
      "/risk/risks/",
      { params },
    );
    return response.data;
  },

  getRisk: async (id: string) => {
    const response = await apiClient.get<Risk>(`/risk/risks/${id}/`);
    return response.data;
  },

  createRisk: async (data: Partial<Risk>) => {
    const response = await apiClient.post<Risk>("/risk/risks/", data);
    return response.data;
  },

  updateRisk: async (id: string, data: Partial<Risk>) => {
    const response = await apiClient.patch<Risk>(`/risk/risks/${id}/`, data);
    return response.data;
  },

  deleteRisk: async (id: string) => {
    await apiClient.delete(`/risk/risks/${id}/`);
  },

  // Risk Analytics
  getRiskSummary: async () => {
    const response = await apiClient.get("/risk/risks/summary/");
    return response.data;
  },

  getHeatMapData: async () => {
    const response = await apiClient.get("/risk/risks/heat_map/");
    return response.data;
  },

  getTopRisks: async (limit = 10) => {
    const response = await apiClient.get("/risk/risks/top_risks/", {
      params: { limit },
    });
    return response.data;
  },

  getTrends: async (months = 12) => {
    const response = await apiClient.get("/risk/risks/trends/", {
      params: { months },
    });
    return response.data;
  },

  getTreatmentPriorities: async () => {
    const response = await apiClient.get("/risk/risks/treatment_priorities/");
    return response.data;
  },

  getByCategory: async () => {
    const response = await apiClient.get("/risk/risks/by_category/");
    return response.data;
  },

  getOverdueReviews: async () => {
    const response = await apiClient.get<Risk[]>(
      "/risk/risks/overdue_reviews/",
    );
    return response.data;
  },

  getHighRisks: async () => {
    const response = await apiClient.get<Risk[]>("/risk/risks/high_risk/");
    return response.data;
  },

  // Risk Assessments
  assessRiskWithControl: async (
    riskId: string,
    data: {
      applied_control: string;
      effectiveness_rating: number;
      assessment_notes?: string;
    },
  ) => {
    const response = await apiClient.post<RiskAssessment>(
      `/risk/risks/${riskId}/assess_with_control/`,
      data,
    );
    return response.data;
  },

  getRiskAssessments: async (riskId: string) => {
    const response = await apiClient.get<RiskAssessment[]>(
      `/risk/risks/${riskId}/assessments/`,
    );
    return response.data;
  },

  getResidualRisk: async (riskId: string) => {
    const response = await apiClient.get(
      `/risk/risks/${riskId}/residual_risk/`,
    );
    return response.data;
  },

  getCurrentAssessments: async () => {
    const response = await apiClient.get<PaginatedResponse<RiskAssessment>>(
      "/risk/assessments/current/",
    );
    return response.data;
  },

  // Risk Events
  getRiskEvents: async (params?: { risk?: string }) => {
    const response = await apiClient.get<PaginatedResponse<RiskEvent>>(
      "/risk/events/",
      { params },
    );
    return response.data;
  },

  createRiskEvent: async (data: Partial<RiskEvent>) => {
    const response = await apiClient.post<RiskEvent>("/risk/events/", data);
    return response.data;
  },

  resolveEvent: async (id: string) => {
    const response = await apiClient.post(`/risk/events/${id}/resolve/`);
    return response.data;
  },

  getUnresolvedEvents: async () => {
    const response = await apiClient.get<RiskEvent[]>(
      "/risk/events/unresolved/",
    );
    return response.data;
  },

  // Treatment Actions
  getTreatmentActions: async (params?: { risk?: string; status?: string }) => {
    const response = await apiClient.get<
      PaginatedResponse<RiskTreatmentAction>
    >("/risk/treatment-actions/", { params });
    return response.data;
  },

  createTreatmentAction: async (data: Partial<RiskTreatmentAction>) => {
    const response = await apiClient.post<RiskTreatmentAction>(
      "/risk/treatment-actions/",
      data,
    );
    return response.data;
  },

  completeTreatmentAction: async (id: string, actualCost?: number) => {
    const response = await apiClient.post(
      `/risk/treatment-actions/${id}/complete/`,
      {
        actual_cost: actualCost,
      },
    );
    return response.data;
  },

  updateProgress: async (
    id: string,
    data: {
      progress_percentage?: number;
      progress_notes?: string;
      status?: string;
    },
  ) => {
    const response = await apiClient.post(
      `/risk/treatment-actions/${id}/update_progress/`,
      data,
    );
    return response.data;
  },

  getOverdueActions: async () => {
    const response = await apiClient.get<RiskTreatmentAction[]>(
      "/risk/treatment-actions/overdue/",
    );
    return response.data;
  },

  getInProgressActions: async () => {
    const response = await apiClient.get<RiskTreatmentAction[]>(
      "/risk/treatment-actions/in_progress/",
    );
    return response.data;
  },
};
