export const RISK_LEVELS = {
  low: { label: "Low", color: "bg-green-100 text-green-800" },
  medium: { label: "Medium", color: "bg-yellow-100 text-yellow-800" },
  high: { label: "High", color: "bg-orange-100 text-orange-800" },
  critical: { label: "Critical", color: "bg-red-100 text-red-800" },
};

export const COMPLIANCE_STATUS = {
  compliant: { label: "Compliant", color: "bg-green-100 text-green-800" },
  mostly_compliant: {
    label: "Mostly Compliant",
    color: "bg-blue-100 text-blue-800",
  },
  partially_compliant: {
    label: "Partially Compliant",
    color: "bg-yellow-100 text-yellow-800",
  },
  non_compliant: { label: "Non-Compliant", color: "bg-red-100 text-red-800" },
};

export const CONTROL_STATUS = {
  not_started: { label: "Not Started", color: "bg-gray-100 text-gray-800" },
  in_progress: { label: "In Progress", color: "bg-blue-100 text-blue-800" },
  implemented: { label: "Implemented", color: "bg-purple-100 text-purple-800" },
  testing: { label: "Testing", color: "bg-yellow-100 text-yellow-800" },
  operational: { label: "Operational", color: "bg-green-100 text-green-800" },
  needs_improvement: {
    label: "Needs Improvement",
    color: "bg-orange-100 text-orange-800",
  },
  non_compliant: { label: "Non-Compliant", color: "bg-red-100 text-red-800" },
};

export const EVIDENCE_STATUS = {
  pending: { label: "Pending Review", color: "bg-gray-100 text-gray-800" },
  approved: { label: "Approved", color: "bg-green-100 text-green-800" },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-800" },
  needs_update: {
    label: "Needs Update",
    color: "bg-yellow-100 text-yellow-800",
  },
};

export const ROLES = {
  owner: "Owner",
  admin: "Administrator",
  manager: "Manager",
  analyst: "Analyst",
  auditor: "Auditor",
  viewer: "Viewer",
};
