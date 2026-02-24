export interface ReferenceControl {
  id: string;
  code: string;
  name: string;
  description: string;
  control_family: string;
  control_type:
    | "preventive"
    | "detective"
    | "corrective"
    | "deterrent"
    | "compensating";
  implementation_guidance: string;
  automation_level: "manual" | "semi_automated" | "automated";
  priority: "critical" | "high" | "medium" | "low";
  is_published: boolean;
  mapped_requirements_count: number;
  /** Framework codes this reference control is mapped to */
  frameworks: string[];
  created_at: string;
}

export interface AppliedControl {
  id: string;
  company: string;
  reference_control: string;
  reference_control_code: string;
  reference_control_name: string;
  reference_control_description?: string;
  reference_control_family?: string;
  reference_control_type?: string;
  department?: string;
  department_name?: string;
  status:
    | "not_started"
    | "in_progress"
    | "implemented"
    | "testing"
    | "operational"
    | "needs_improvement"
    | "non_compliant";
  control_owner?: string;
  control_owner_email?: string;
  implementation_notes: string;
  effectiveness_rating?: number;
  last_tested_date?: string;
  next_review_date?: string;
  has_deficiencies: boolean;
  evidence_count: number;
  compliance_score: number;
  is_overdue: boolean;
  /** Framework codes satisfied by this applied control — e.g. ["ISO-27001", "TISAX"] */
  frameworks: string[];
  created_at: string;
}

export interface ControlDashboard {
  total_controls: number;
  status_breakdown: Array<{ status: string; count: number }>;
  avg_compliance_score: number;
  family_breakdown: Array<{
    reference_control__control_family: string;
    count: number;
  }>;
  overdue_reviews: number;
  controls_with_deficiencies: number;
  evidence_coverage_percentage: number;
}
