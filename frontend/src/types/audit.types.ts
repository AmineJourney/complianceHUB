export interface AuditLog {
  id: string;
  action: string;
  action_display?: string;
  resource_type: string;
  object_id: string;
  object_repr: string;
  actor: string | null;
  actor_email: string | null;
  ip_address: string | null;
  changes: Record<string, [string | null, string | null]>;
  metadata: Record<string, unknown>;
  timestamp: string;
}

export interface AuditSummary {
  total_last_30_days: number;
  by_action: Array<{ action: string; count: number }>;
  by_actor: Array<{ actor_email: string; count: number }>;
  by_resource: Array<{ resource_type: string; count: number }>;
}
