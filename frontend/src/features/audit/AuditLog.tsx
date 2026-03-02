import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { auditApi } from "../../api/audit";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import {
  Shield,
  FileText,
  AlertTriangle,
  Users,
  BarChart3,
  Download,
  Search,
  X,
  ChevronDown,
  ChevronRight,
  Clock,
  Activity,
} from "lucide-react";
import { formatDateTime } from "../../lib/utils";
import type { AuditLog } from "../../types/audit.types";

// ─── Action config ─────────────────────────────────────────────────────────

const ACTION_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ReactNode }
> = {
  // Controls
  control_applied: {
    label: "Control Applied",
    color: "bg-blue-100 text-blue-800",
    icon: <Shield className="h-3.5 w-3.5" />,
  },
  control_updated: {
    label: "Control Updated",
    color: "bg-blue-50 text-blue-700",
    icon: <Shield className="h-3.5 w-3.5" />,
  },
  control_deleted: {
    label: "Control Deleted",
    color: "bg-red-100 text-red-800",
    icon: <Shield className="h-3.5 w-3.5" />,
  },
  control_status_changed: {
    label: "Status Changed",
    color: "bg-indigo-100 text-indigo-800",
    icon: <Shield className="h-3.5 w-3.5" />,
  },
  // Evidence
  evidence_uploaded: {
    label: "Evidence Uploaded",
    color: "bg-green-100 text-green-800",
    icon: <FileText className="h-3.5 w-3.5" />,
  },
  evidence_approved: {
    label: "Evidence Approved",
    color: "bg-green-200 text-green-900",
    icon: <FileText className="h-3.5 w-3.5" />,
  },
  evidence_rejected: {
    label: "Evidence Rejected",
    color: "bg-red-100 text-red-800",
    icon: <FileText className="h-3.5 w-3.5" />,
  },
  evidence_deleted: {
    label: "Evidence Deleted",
    color: "bg-red-50 text-red-700",
    icon: <FileText className="h-3.5 w-3.5" />,
  },
  evidence_downloaded: {
    label: "Evidence Downloaded",
    color: "bg-gray-100 text-gray-700",
    icon: <FileText className="h-3.5 w-3.5" />,
  },
  evidence_linked: {
    label: "Evidence Linked",
    color: "bg-teal-100 text-teal-800",
    icon: <FileText className="h-3.5 w-3.5" />,
  },
  evidence_unlinked: {
    label: "Evidence Unlinked",
    color: "bg-orange-100 text-orange-800",
    icon: <FileText className="h-3.5 w-3.5" />,
  },
  evidence_updated: {
    label: "Evidence Updated",
    color: "bg-green-50 text-green-700",
    icon: <FileText className="h-3.5 w-3.5" />,
  },
  // Risk
  risk_created: {
    label: "Risk Created",
    color: "bg-yellow-100 text-yellow-800",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
  risk_updated: {
    label: "Risk Updated",
    color: "bg-yellow-50 text-yellow-700",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
  risk_deleted: {
    label: "Risk Deleted",
    color: "bg-red-100 text-red-800",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
  risk_status_changed: {
    label: "Risk Status Changed",
    color: "bg-yellow-200 text-yellow-900",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
  risk_assessed: {
    label: "Risk Assessed",
    color: "bg-yellow-100 text-yellow-800",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
  // Compliance
  compliance_calculated: {
    label: "Compliance Calculated",
    color: "bg-purple-100 text-purple-800",
    icon: <BarChart3 className="h-3.5 w-3.5" />,
  },
  framework_adopted: {
    label: "Framework Adopted",
    color: "bg-purple-200 text-purple-900",
    icon: <BarChart3 className="h-3.5 w-3.5" />,
  },
  framework_certified: {
    label: "Framework Certified",
    color: "bg-purple-300 text-purple-950",
    icon: <BarChart3 className="h-3.5 w-3.5" />,
  },
  // Members
  member_invited: {
    label: "Member Invited",
    color: "bg-cyan-100 text-cyan-800",
    icon: <Users className="h-3.5 w-3.5" />,
  },
  member_joined: {
    label: "Member Joined",
    color: "bg-cyan-200 text-cyan-900",
    icon: <Users className="h-3.5 w-3.5" />,
  },
  member_role_changed: {
    label: "Role Changed",
    color: "bg-cyan-100 text-cyan-800",
    icon: <Users className="h-3.5 w-3.5" />,
  },
  member_removed: {
    label: "Member Removed",
    color: "bg-red-100 text-red-800",
    icon: <Users className="h-3.5 w-3.5" />,
  },
};

function actionConfig(action: string) {
  return (
    ACTION_CONFIG[action] ?? {
      label: action.replace(/_/g, " "),
      color: "bg-gray-100 text-gray-700",
      icon: <Activity className="h-3.5 w-3.5" />,
    }
  );
}

// ─── Changes diff viewer ───────────────────────────────────────────────────

function DiffViewer({
  changes,
}: {
  changes: Record<string, [string | null, string | null]>;
}) {
  const entries = Object.entries(changes);
  if (entries.length === 0) return null;

  return (
    <div className="mt-3 rounded-lg border border-gray-200 overflow-hidden text-xs font-mono">
      <table className="w-full">
        <thead className="bg-gray-50 text-gray-500 text-xs">
          <tr>
            <th className="px-3 py-1.5 text-left font-medium">Field</th>
            <th className="px-3 py-1.5 text-left font-medium">Before</th>
            <th className="px-3 py-1.5 text-left font-medium">After</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {entries.map(([field, [oldVal, newVal]]) => (
            <tr key={field} className="bg-white">
              <td className="px-3 py-1.5 text-gray-600 font-sans">
                {field.replace(/_/g, " ")}
              </td>
              <td className="px-3 py-1.5 text-red-600 line-through">
                {oldVal ?? (
                  <span className="text-gray-300 not-italic font-sans">—</span>
                )}
              </td>
              <td className="px-3 py-1.5 text-green-700 font-semibold">
                {newVal ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Metadata viewer ───────────────────────────────────────────────────────

function MetadataViewer({ metadata }: { metadata: Record<string, unknown> }) {
  const entries = Object.entries(metadata).filter(
    ([, v]) => v !== null && v !== "",
  );
  if (entries.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {entries.map(([key, val]) => (
        <span
          key={key}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs"
        >
          <span className="text-gray-400">{key.replace(/_/g, " ")}:</span>
          <span>{String(val)}</span>
        </span>
      ))}
    </div>
  );
}

// ─── Single log row ────────────────────────────────────────────────────────

function AuditRow({ log }: { log: AuditLog }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = actionConfig(log.action);
  const hasDetail =
    Object.keys(log.changes).length > 0 || Object.keys(log.metadata).length > 0;

  return (
    <div className="border-b border-gray-100 last:border-0">
      <div
        className={`flex items-start gap-4 px-4 py-3 hover:bg-gray-50 transition-colors ${
          hasDetail ? "cursor-pointer" : ""
        }`}
        onClick={() => hasDetail && setExpanded((e) => !e)}
      >
        {/* Timeline dot */}
        <div className="flex flex-col items-center mt-1 flex-shrink-0">
          <div
            className={`h-7 w-7 rounded-full flex items-center justify-center border-2 border-white shadow-sm ${cfg.color}`}
          >
            {cfg.icon}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}
            >
              {cfg.label}
            </span>
            <span className="text-sm font-medium text-gray-900 truncate">
              {log.object_repr}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400 flex-wrap">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDateTime(log.timestamp)}
            </span>
            <span>{log.actor_email || "system"}</span>
            {log.ip_address && <span>IP: {log.ip_address}</span>}
            <span className="text-gray-300">{log.resource_type}</span>
          </div>
        </div>

        {hasDetail && (
          <div className="flex-shrink-0 text-gray-300 mt-1">
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </div>
        )}
      </div>

      {/* Expanded detail */}
      {expanded && hasDetail && (
        <div className="px-4 pb-4 ml-11">
          <MetadataViewer metadata={log.metadata} />
          <DiffViewer changes={log.changes} />
        </div>
      )}
    </div>
  );
}

// ─── Summary stats bar ─────────────────────────────────────────────────────

function SummaryBar() {
  const { data } = useQuery({
    queryKey: ["audit-summary"],
    queryFn: auditApi.getSummary,
    staleTime: 60_000,
  });

  if (!data) return null;

  const topActions = data.by_action.slice(0, 5);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">
            Events (30d)
          </p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            {data.total_last_30_days.toLocaleString()}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">
            Active actors
          </p>
          <p className="text-3xl font-bold text-gray-900 mt-1">
            {data.by_actor.length}
          </p>
        </CardContent>
      </Card>
      <Card className="md:col-span-2">
        <CardContent className="p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">
            Top actions
          </p>
          <div className="flex flex-wrap gap-2">
            {topActions.map(({ action, count }) => {
              const cfg = actionConfig(action);
              return (
                <span
                  key={action}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}
                >
                  {cfg.label}
                  <span className="ml-1 font-bold">{count}</span>
                </span>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Filters bar ───────────────────────────────────────────────────────────

const RESOURCE_TYPES = [
  "AppliedControl",
  "Evidence",
  "AppliedControlEvidence",
  "Risk",
  "ComplianceResult",
  "FrameworkAdoption",
  "Membership",
];

const ACTION_GROUPS: Record<string, string[]> = {
  Controls: [
    "control_applied",
    "control_updated",
    "control_deleted",
    "control_status_changed",
  ],
  Evidence: [
    "evidence_uploaded",
    "evidence_approved",
    "evidence_rejected",
    "evidence_linked",
    "evidence_unlinked",
    "evidence_deleted",
    "evidence_downloaded",
  ],
  Risk: ["risk_created", "risk_updated", "risk_deleted", "risk_status_changed"],
  Compliance: [
    "compliance_calculated",
    "framework_adopted",
    "framework_certified",
  ],
  Members: [
    "member_invited",
    "member_joined",
    "member_role_changed",
    "member_removed",
  ],
};

interface Filters {
  search: string;
  action: string;
  resource_type: string;
  actor_email: string;
  date_from: string;
  date_to: string;
}

function FiltersPanel({
  filters,
  onChange,
  onReset,
}: {
  filters: Filters;
  onChange: (f: Partial<Filters>) => void;
  onReset: () => void;
}) {
  const active = Object.values(filters).some(Boolean);

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search object, actor…"
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value })}
            className="w-full pl-9 pr-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Action group filter */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">Category</label>
            <select
              value={filters.action}
              onChange={(e) =>
                onChange({ action: e.target.value, resource_type: "" })
              }
              className="w-full border rounded-md text-sm py-2 px-2 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All categories</option>
              {Object.entries(ACTION_GROUPS).map(([group, actions]) => (
                <optgroup key={group} label={group}>
                  {actions.map((a) => (
                    <option key={a} value={a}>
                      {actionConfig(a).label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Resource type */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">
              Resource type
            </label>
            <select
              value={filters.resource_type}
              onChange={(e) => onChange({ resource_type: e.target.value })}
              className="w-full border rounded-md text-sm py-2 px-2 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All types</option>
              {RESOURCE_TYPES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Date from */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">
              From date
            </label>
            <input
              type="date"
              value={filters.date_from}
              onChange={(e) => onChange({ date_from: e.target.value })}
              className="w-full border rounded-md text-sm py-2 px-2 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Date to */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">To date</label>
            <input
              type="date"
              value={filters.date_to}
              onChange={(e) => onChange({ date_to: e.target.value })}
              className="w-full border rounded-md text-sm py-2 px-2 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {active && (
          <div className="flex justify-end">
            <button
              onClick={onReset}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700"
            >
              <X className="h-3 w-3" /> Clear filters
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────

const EMPTY_FILTERS: Filters = {
  search: "",
  action: "",
  resource_type: "",
  actor_email: "",
  date_from: "",
  date_to: "",
};

export function AuditLogPage() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  const params = {
    page,
    page_size: PAGE_SIZE,
    search: filters.search || undefined,
    action: filters.action || undefined,
    resource_type: filters.resource_type || undefined,
    actor_email: filters.actor_email || undefined,
    date_from: filters.date_from || undefined,
    date_to: filters.date_to || undefined,
  };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["audit-logs", params],
    queryFn: () => auditApi.getLogs(params),
    placeholderData: keepPreviousData,
  });

  const handleFilter = (partial: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...partial }));
    setPage(1);
  };

  const handleExport = () => {
    // Build query string from current filters and open the CSV stream
    const qs = new URLSearchParams();
    if (filters.search) qs.set("search", filters.search);
    if (filters.action) qs.set("action", filters.action);
    if (filters.resource_type) qs.set("resource_type", filters.resource_type);
    if (filters.actor_email) qs.set("actor_email", filters.actor_email);
    if (filters.date_from) qs.set("date_from", filters.date_from);
    if (filters.date_to) qs.set("date_to", filters.date_to);
    window.location.href = `/api/audit/logs/export_csv/?${qs.toString()}`;
  };

  const totalPages = data ? Math.ceil(data.count / PAGE_SIZE) : 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Audit Log
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Immutable record of every significant action across controls,
            evidence, risks, and users
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="mr-1.5 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Summary stats */}
      <SummaryBar />

      {/* Filters */}
      <FiltersPanel
        filters={filters}
        onChange={handleFilter}
        onReset={() => {
          setFilters(EMPTY_FILTERS);
          setPage(1);
        }}
      />

      {/* Log table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Events {data ? `(${data.count.toLocaleString()})` : ""}
            </CardTitle>
            {isFetching && !isLoading && (
              <span className="text-xs text-gray-400 animate-pulse">
                Refreshing…
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12">
              <LoadingSpinner />
            </div>
          ) : data?.results.length === 0 ? (
            <div className="text-center py-16">
              <Activity className="h-10 w-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">
                No audit events match your filters
              </p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-gray-50">
                {data?.results.map((log) => (
                  <AuditRow key={log.id} log={log} />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <p className="text-xs text-gray-500">
                    Page {page} of {totalPages} · {data?.count.toLocaleString()}{" "}
                    total events
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={page === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
