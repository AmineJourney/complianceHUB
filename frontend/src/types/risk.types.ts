/* eslint-disable @typescript-eslint/no-explicit-any */
export interface RiskMatrix {
  id: string;
  name: string;
  description: string;
  likelihood_levels: number;
  impact_levels: number;
  likelihood_definitions: Record<string, any>;
  impact_definitions: Record<string, any>;
  is_active: boolean;
  created_at: string;
}

export interface Risk {
  id: string;
  risk_id: string;
  title: string;
  description: string;
  risk_category: string;
  risk_source: "internal" | "external" | "both";
  inherent_likelihood: number;
  inherent_impact: number;
  inherent_risk_score: number;
  inherent_risk_level: "low" | "medium" | "high" | "critical";
  risk_owner?: string;
  risk_owner_email?: string;
  status: "identified" | "assessing" | "treating" | "monitoring" | "closed";
  treatment_strategy: "mitigate" | "transfer" | "accept" | "avoid";
  residual_risk_data: {
    residual_score: number;
    residual_level: string;
    control_count: number;
    avg_effectiveness: number;
    risk_reduction: number;
  };
  next_review_date?: string;
  is_overdue: boolean;
  created_at: string;
}

export interface RiskAssessment {
  id: string;
  risk: string;
  applied_control: string;
  control_code: string;
  control_name: string;
  control_effectiveness:
    | "not_effective"
    | "partially_effective"
    | "effective"
    | "highly_effective";
  effectiveness_rating: number;
  residual_likelihood: number;
  residual_impact: number;
  residual_score: number;
  residual_risk_level: string;
  assessment_date: string;
  risk_reduction: number;
  is_current: boolean;
}
