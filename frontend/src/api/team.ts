/* eslint-disable @typescript-eslint/no-explicit-any */
// src/api/team.ts
import apiClient from "./client";
import type { Membership } from "@/types/auth.types";

export interface Invitation {
  id: string;
  company: string;
  company_name: string;
  invited_by: string;
  invited_by_email: string;
  invited_by_name: string;
  email: string;
  role: string;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
  is_revoked: boolean;
  is_expired: boolean;
  is_valid: boolean;
  created_at: string;
}

export interface InvitationPreview {
  company_name: string;
  invited_by_name: string;
  role: string;
  email: string;
  expires_at: string;
  is_valid: boolean;
}

export interface CreateInvitationRequest {
  role: string;
  email?: string;
}

export const teamApi = {
  // ── Members ──────────────────────────────────────────────────────────────

  /** Get all members of the current company (requires X-Company-ID header). */
  getCompanyMembers: async (): Promise<Membership[]> => {
    const response = await apiClient.get<Membership[]>(
      "/memberships/company_members/",
    );
    return response.data;
  },

  /** Change a member's role. */
  updateMemberRole: async (
    membershipId: string,
    role: string,
  ): Promise<Membership> => {
    const response = await apiClient.patch<Membership>(
      `/memberships/${membershipId}/`,
      { role },
    );
    return response.data;
  },

  /** Remove a member from the company. */
  removeMember: async (membershipId: string): Promise<void> => {
    await apiClient.delete(`/memberships/${membershipId}/`);
  },

  // ── Invitations ───────────────────────────────────────────────────────────

  /** List all invitations for the current company. */
  getInvitations: async (): Promise<Invitation[]> => {
    const response = await apiClient.get<Invitation[]>("/invitations/");
    // DRF router wraps in paginated response
    const data = response.data as any;
    return Array.isArray(data) ? data : (data.results ?? []);
  },

  /** Create a new invitation link. */
  createInvitation: async (
    data: CreateInvitationRequest,
  ): Promise<Invitation> => {
    const response = await apiClient.post<Invitation>("/invitations/", data);
    return response.data;
  },

  /** Revoke an invitation. */
  revokeInvitation: async (invitationId: string): Promise<void> => {
    await apiClient.post(`/invitations/${invitationId}/revoke/`);
  },

  // ── Public / accept ───────────────────────────────────────────────────────

  /**
   * Get invite preview — public, no auth required.
   * Used by the AcceptInvite page before the user logs in.
   */
  previewInvitation: async (token: string): Promise<InvitationPreview> => {
    const response = await apiClient.get<InvitationPreview>(
      `/invitations/preview/?token=${token}`,
    );
    return response.data;
  },

  /** Accept an invitation as the currently logged-in user. */
  acceptInvitation: async (token: string) => {
    const response = await apiClient.post("/invitations/accept/", { token });
    return response.data as {
      message: string;
      company: import("@/types/auth.types").Company;
      membership: Membership;
    };
  },
};
