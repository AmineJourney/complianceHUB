// src/types/library.types.ts
export interface ComplianceFramework {
  id: string;
  code: string;
  name: string;
  version: string;
  description: string;
  issuing_organization: string;
  effective_date?: string;
  documentation_url?: string;
  is_active: boolean;
  requirement_count: number;
  mandatory_requirement_count: number;
  created_at: string;
  updated_at: string;
}

export interface FrameworkRequirement {
  id: string;
  framework: string;
  framework_code: string;
  framework_name: string;
  requirement_id: string;
  section: string;
  title: string;
  description: string;
  parent?: string;
  parent_requirement_id?: string;
  full_path: string;
  is_mandatory: boolean;
  implementation_guidance: string;
  evidence_requirements: string;
  priority: "critical" | "high" | "medium" | "low";
  mapped_controls_count: number;
  created_at: string;
  updated_at: string;
}

export interface FrameworkRequirementTree {
  id: string;
  requirement_id: string;
  section: string;
  title: string;
  is_mandatory: boolean;
  priority: string;
  mapped_controls_count: number;
  children: FrameworkRequirementTree[];
}

export interface ControlMapping {
  id: string;
  control: string;
  control_code: string;
  control_name: string;
  framework_requirement: string;
  requirement_id: string;
  requirement_title: string;
  framework_code: string;
  mapping_strength: "direct" | "partial" | "supporting";
  is_primary: boolean;
  mapping_notes: string;
  created_at: string;
  updated_at: string;
}

export interface FrameworkStatistics {
  total_requirements: number;
  mandatory_requirements: number;
  optional_requirements: number;
  by_priority: Record<string, number>;
  by_section: Array<{ section: string; count: number }>;
}
