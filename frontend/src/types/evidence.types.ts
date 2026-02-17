export interface Evidence {
  id: string;
  company: string;
  name: string;
  description: string;
  file: string;
  file_url: string;
  file_size: number;
  file_size_display: string;
  file_type: string;
  file_extension: string;
  file_hash: string;
  evidence_type:
    | "policy"
    | "procedure"
    | "screenshot"
    | "report"
    | "log"
    | "certificate"
    | "configuration"
    | "scan_result"
    | "audit_report"
    | "training_record"
    | "other";
  is_valid: boolean;
  validity_start_date?: string;
  validity_end_date?: string;
  uploaded_by?: string;
  uploaded_by_email?: string;
  verification_status: "pending" | "approved" | "rejected" | "needs_update";
  verified_by?: string;
  verified_by_email?: string;
  verified_at?: string;
  verification_notes: string;
  is_confidential: boolean;
  tags: string[];
  version: string;
  previous_version?: string;
  linked_controls_count: number;
  is_expired: boolean;
  created_at: string;
  updated_at: string;
}

export interface AppliedControlEvidence {
  id: string;
  company: string;
  applied_control: string;
  control_code: string;
  control_name: string;
  evidence: string;
  evidence_name: string;
  link_type:
    | "implementation"
    | "testing"
    | "monitoring"
    | "documentation"
    | "audit";
  notes: string;
  linked_by?: string;
  linked_by_email?: string;
  relevance_score: number;
  created_at: string;
}

export interface EvidenceComment {
  id: string;
  evidence: string;
  author?: string;
  author_email?: string;
  author_name: string;
  comment: string;
  parent?: string;
  replies: EvidenceComment[];
  created_at: string;
}

export interface EvidenceAnalytics {
  total_evidence: number;
  by_type: Array<{ evidence_type: string; count: number }>;
  by_status: Array<{ verification_status: string; count: number }>;
  expired_count: number;
  unlinked_count: number;
  storage: {
    used_mb: number;
    quota_mb: number;
    available_mb: number;
    usage_percentage: number;
    is_over_quota: boolean;
  };
}
