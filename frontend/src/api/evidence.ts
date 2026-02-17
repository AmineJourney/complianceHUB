import apiClient from "./client";
import type {
  Evidence,
  AppliedControlEvidence,
  EvidenceComment,
  EvidenceAnalytics,
} from "../types/evidence.types";

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export const evidenceApi = {
  // Evidence CRUD
  getEvidenceList: async (params?: {
    page?: number;
    page_size?: number;
    search?: string;
    evidence_type?: string;
    verification_status?: string;
    uploaded_by?: string;
  }) => {
    const response = await apiClient.get<PaginatedResponse<Evidence>>(
      "/evidence/evidence/",
      { params },
    );
    return response.data;
  },

  getEvidence: async (id: string) => {
    const response = await apiClient.get<Evidence>(`/evidence/evidence/${id}/`);
    return response.data;
  },

  uploadEvidence: async (formData: FormData) => {
    const response = await apiClient.post<Evidence>(
      "/evidence/evidence/",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );
    return response.data;
  },

  updateEvidence: async (id: string, data: Partial<Evidence>) => {
    const response = await apiClient.patch<Evidence>(
      `/evidence/evidence/${id}/`,
      data,
    );
    return response.data;
  },

  deleteEvidence: async (id: string) => {
    await apiClient.delete(`/evidence/evidence/${id}/`);
  },

  downloadEvidence: async (id: string) => {
    const response = await apiClient.get(`/evidence/evidence/${id}/download/`, {
      responseType: "blob",
    });
    return response.data;
  },

  // Approval workflow
  approveEvidence: async (id: string, notes?: string) => {
    const response = await apiClient.post<Evidence>(
      `/evidence/evidence/${id}/approve/`,
      { notes },
    );
    return response.data;
  },

  rejectEvidence: async (id: string, reason: string) => {
    const response = await apiClient.post<Evidence>(
      `/evidence/evidence/${id}/reject/`,
      { reason },
    );
    return response.data;
  },

  // Versioning
  createVersion: async (id: string, file: File, description?: string) => {
    const formData = new FormData();
    formData.append("file", file);
    if (description) formData.append("description", description);

    const response = await apiClient.post<Evidence>(
      `/evidence/evidence/${id}/create_version/`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );
    return response.data;
  },

  getVersions: async (id: string) => {
    const response = await apiClient.get<Evidence[]>(
      `/evidence/evidence/${id}/versions/`,
    );
    return response.data;
  },

  // Analytics
  getAnalytics: async () => {
    const response = await apiClient.get<EvidenceAnalytics>(
      "/evidence/evidence/analytics/",
    );
    return response.data;
  },

  getStorageQuota: async () => {
    const response = await apiClient.get("/evidence/evidence/storage_quota/");
    return response.data;
  },

  getExpiredEvidence: async () => {
    const response = await apiClient.get<Evidence[]>(
      "/evidence/evidence/expired/",
    );
    return response.data;
  },

  getPendingApproval: async () => {
    const response = await apiClient.get<Evidence[]>(
      "/evidence/evidence/pending_approval/",
    );
    return response.data;
  },

  getUnlinkedEvidence: async () => {
    const response = await apiClient.get<Evidence[]>(
      "/evidence/evidence/unlinked/",
    );
    return response.data;
  },

  // Control-Evidence Links
  getControlEvidenceLinks: async (params?: {
    applied_control?: string;
    evidence?: string;
  }) => {
    const response = await apiClient.get<
      PaginatedResponse<AppliedControlEvidence>
    >("/evidence/control-evidence-links/", { params });
    return response.data;
  },

  createControlEvidenceLink: async (data: Partial<AppliedControlEvidence>) => {
    const response = await apiClient.post<AppliedControlEvidence>(
      "/evidence/control-evidence-links/",
      data,
    );
    return response.data;
  },

  deleteControlEvidenceLink: async (id: string) => {
    await apiClient.delete(`/evidence/control-evidence-links/${id}/`);
  },

  bulkLinkEvidence: async (data: {
    evidence_ids: string[];
    control_ids: string[];
    link_type?: string;
  }) => {
    const response = await apiClient.post(
      "/evidence/control-evidence-links/bulk_link/",
      data,
    );
    return response.data;
  },

  // Comments
  getComments: async (evidenceId: string) => {
    const response = await apiClient.get<PaginatedResponse<EvidenceComment>>(
      "/evidence/comments/",
      { params: { evidence: evidenceId } },
    );
    return response.data;
  },

  createComment: async (data: {
    evidence: string;
    comment: string;
    parent?: string;
  }) => {
    const response = await apiClient.post<EvidenceComment>(
      "/evidence/comments/",
      data,
    );
    return response.data;
  },

  deleteComment: async (id: string) => {
    await apiClient.delete(`/evidence/comments/${id}/`);
  },
};
