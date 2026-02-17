export interface ComplianceResult {
  id: string;
  framework: string;
  framework_code: string;
  framework_name: string;
  department?: string;
  department_name?: string;
  coverage_percentage: number;
  compliance_score: number;
  compliance_grade: string;
  compliance_status:
    | "compliant"
    | "mostly_compliant"
    | "partially_compliant"
    | "non_compliant";
  total_requirements: number;
  requirements_compliant: number;
  requirements_partial: number;
  requirements_non_compliant: number;
  total_controls: number;
  controls_operational: number;
  gap_count: number;
  calculation_date: string;
  is_current: boolean;
}

export interface ComplianceOverview {
  total_frameworks: number;
  avg_compliance_score: number;
  avg_coverage: number;
  frameworks: Array<{
    framework_id: string;
    framework_code: string;
    framework_name: string;
    compliance_score: number;
    coverage_percentage: number;
    grade: string;
    status: string;
    gap_count: number;
  }>;
}

export interface FrameworkAdoption {
  id: string;
  framework: string;
  framework_code: string;
  framework_name: string;
  adoption_status:
    | "planning"
    | "implementing"
    | "operational"
    | "certified"
    | "suspended";
  is_certified: boolean;
  certification_date?: string;
  certification_expiry_date?: string;
  target_completion_date?: string;
  created_at: string;
}
