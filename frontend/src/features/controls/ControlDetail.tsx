/* eslint-disable @typescript-eslint/no-unused-expressions */
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { controlsApi } from "../../api/controls";
import { evidenceApi } from "../../api/evidence";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import {
  ArrowLeft,
  Edit,
  Trash2,
  FileText,
  Calendar,
  User,
  AlertCircle,
  Upload,
  Link as LinkIcon,
  Unlink,
  ExternalLink,
  CheckCircle,
  Clock,
  XCircle,
  RefreshCw,
  Shield,
  Layers,
  Search,
  X,
} from "lucide-react";
import { CONTROL_STATUS } from "../../lib/constants";
import { formatDate } from "../../lib/utils";
import { EditControlDialog } from "./EditControlDialog";
import { UploadEvidenceDialog } from "../evidence/UploadEvidenceDialog";
import type { AppliedControlEvidence } from "../../types/evidence.types";

// ─── Framework colours ──────────────────────────────────────────────────────

const FRAMEWORK_COLOURS: Record<string, string> = {
  "ISO-27001": "bg-blue-100 text-blue-800 border-blue-200",
  "ISO 27001": "bg-blue-100 text-blue-800 border-blue-200",
  TISAX: "bg-purple-100 text-purple-800 border-purple-200",
  "SOC 2": "bg-emerald-100 text-emerald-800 border-emerald-200",
  GDPR: "bg-orange-100 text-orange-800 border-orange-200",
  NIST: "bg-cyan-100 text-cyan-800 border-cyan-200",
};

function FrameworkBadge({ code }: { code: string }) {
  const cls =
    FRAMEWORK_COLOURS[code] ?? "bg-gray-100 text-gray-700 border-gray-200";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}
    >
      {code}
    </span>
  );
}

// ─── Verification badge map ─────────────────────────────────────────────────

const V_BADGE: Record<
  string,
  { label: string; icon: React.ReactNode; cls: string }
> = {
  pending: {
    label: "Pending",
    icon: <Clock className="h-3 w-3" />,
    cls: "bg-yellow-100 text-yellow-800 border-yellow-200",
  },
  approved: {
    label: "Approved",
    icon: <CheckCircle className="h-3 w-3" />,
    cls: "bg-green-100 text-green-800 border-green-200",
  },
  rejected: {
    label: "Rejected",
    icon: <XCircle className="h-3 w-3" />,
    cls: "bg-red-100 text-red-800 border-red-200",
  },
  needs_update: {
    label: "Needs Update",
    icon: <RefreshCw className="h-3 w-3" />,
    cls: "bg-orange-100 text-orange-800 border-orange-200",
  },
};

const LINK_TYPE_LABEL: Record<string, string> = {
  implementation: "Implementation",
  testing: "Testing",
  monitoring: "Monitoring",
  documentation: "Documentation",
  audit: "Audit",
};

// ─── Link Existing Evidence Dialog ─────────────────────────────────────────

function LinkEvidenceDialog({
  controlId,
  onSuccess,
  onClose,
}: {
  controlId: string;
  onSuccess: () => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [linkType, setLinkType] = useState("implementation");

  const { data, isLoading } = useQuery({
    queryKey: ["evidence-picker", search],
    queryFn: () =>
      evidenceApi.getEvidenceList({
        search: search || undefined,
        page_size: 50,
      }),
  });

  const linkMutation = useMutation({
    mutationFn: () =>
      evidenceApi.bulkLinkEvidence({
        evidence_ids: Array.from(selected),
        control_ids: [controlId],
        link_type: linkType,
      }),
    onSuccess,
  });

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="p-5 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Link Existing Evidence</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Select files to link to this control
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          {/* Link type */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(LINK_TYPE_LABEL).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setLinkType(val)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  linkType === val
                    ? "bg-primary text-white border-primary"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search evidence..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {isLoading ? (
            <LoadingSpinner />
          ) : data?.results.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
              No evidence found — upload some first.
            </p>
          ) : (
            <div className="space-y-2">
              {data?.results.map((ev) => {
                const isChecked = selected.has(ev.id);
                const v = V_BADGE[ev.verification_status];
                return (
                  <div
                    key={ev.id}
                    onClick={() => toggle(ev.id)}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      isChecked
                        ? "bg-primary/5 border-primary"
                        : "hover:bg-gray-50 border-gray-200"
                    }`}
                  >
                    <input
                      type="checkbox"
                      readOnly
                      checked={isChecked}
                      className="h-4 w-4 text-primary"
                    />
                    <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{ev.name}</p>
                      <p className="text-xs text-gray-500">
                        {ev.evidence_type} · {ev.file_size_display}
                      </p>
                    </div>
                    {v && (
                      <span
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${v.cls}`}
                      >
                        {v.icon} {v.label}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-4 border-t flex justify-between items-center">
          <span className="text-sm text-gray-500">
            {selected.size > 0 ? `${selected.size} selected` : ""}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={selected.size === 0 || linkMutation.isPending}
              onClick={() => linkMutation.mutate()}
            >
              {linkMutation.isPending
                ? "Linking…"
                : `Link${selected.size > 0 ? ` (${selected.size})` : ""}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Evidence row in the panel ──────────────────────────────────────────────

function EvidenceLinkRow({
  link,
  onUnlink,
  unlinking,
}: {
  link: AppliedControlEvidence;
  onUnlink: () => void;
  unlinking: boolean;
}) {
  const navigate = useNavigate();

  const { data: ev } = useQuery({
    queryKey: ["evidence-item", link.evidence],
    queryFn: () => evidenceApi.getEvidence(link.evidence),
    staleTime: 60_000,
  });

  const v = ev ? V_BADGE[ev.verification_status] : null;

  return (
    <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 group transition-colors">
      <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
        <FileText className="h-4 w-4 text-blue-600" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-sm text-gray-900 truncate">
            {link.evidence_name}
          </p>
          {v && (
            <span
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${v.cls}`}
            >
              {v.icon} {v.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 flex-wrap">
          <span className="capitalize">
            {LINK_TYPE_LABEL[link.link_type] ?? link.link_type}
          </span>
          {ev && (
            <>
              <span className="text-gray-300">·</span>
              <span>{ev.file_size_display}</span>
              {ev.file_extension && (
                <>
                  <span className="text-gray-300">·</span>
                  <span className="font-mono uppercase">
                    {ev.file_extension.replace(".", "")}
                  </span>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-gray-400 hover:text-primary"
          onClick={() => navigate(`/evidence/${link.evidence}`)}
          title="View evidence"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-gray-400 hover:text-red-600"
          onClick={onUnlink}
          disabled={unlinking}
          title="Unlink"
        >
          <Unlink className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ─── Evidence Panel ─────────────────────────────────────────────────────────

function EvidencePanel({ controlId }: { controlId: string }) {
  const queryClient = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);
  const [showLinkExisting, setShowLinkExisting] = useState(false);

  const { data: links, isLoading } = useQuery({
    queryKey: ["control-evidence-links", controlId],
    queryFn: () =>
      evidenceApi.getControlEvidenceLinks({ applied_control: controlId }),
  });

  const unlinkMutation = useMutation({
    mutationFn: (linkId: string) =>
      evidenceApi.deleteControlEvidenceLink(linkId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["control-evidence-links", controlId],
      });
      queryClient.invalidateQueries({
        queryKey: ["applied-control", controlId],
      });
    },
  });

  const refetchAll = () => {
    queryClient.invalidateQueries({
      queryKey: ["control-evidence-links", controlId],
    });
    queryClient.invalidateQueries({ queryKey: ["applied-control", controlId] });
  };

  const items: AppliedControlEvidence[] = links?.results ?? [];

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Evidence
              </CardTitle>
              <CardDescription>
                {items.length === 0
                  ? "No evidence linked yet"
                  : `${items.length} file${items.length !== 1 ? "s" : ""} — click a file to view it in full`}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowLinkExisting(true)}
              >
                <LinkIcon className="mr-1.5 h-4 w-4" />
                Link existing
              </Button>
              <Button size="sm" onClick={() => setShowUpload(true)}>
                <Upload className="mr-1.5 h-4 w-4" />
                Upload new
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <LoadingSpinner />
          ) : items.length === 0 ? (
            <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-lg">
              <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No evidence linked yet</p>
              <p className="text-gray-400 text-xs mt-1 max-w-xs mx-auto">
                Evidence linked here will count toward compliance scores in all
                frameworks that share this control.
              </p>
              <div className="flex justify-center gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowLinkExisting(true)}
                >
                  <LinkIcon className="mr-1.5 h-3.5 w-3.5" />
                  Link existing
                </Button>
                <Button size="sm" onClick={() => setShowUpload(true)}>
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  Upload new
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((link) => (
                <EvidenceLinkRow
                  key={link.id}
                  link={link}
                  onUnlink={() => unlinkMutation.mutate(link.id)}
                  unlinking={unlinkMutation.isPending}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {showUpload && (
        <UploadEvidenceDialog
          open={showUpload}
          preselectedControlId={controlId}
          onClose={() => setShowUpload(false)}
          onSuccess={refetchAll}
        />
      )}

      {showLinkExisting && (
        <LinkEvidenceDialog
          controlId={controlId}
          onClose={() => setShowLinkExisting(false)}
          onSuccess={() => {
            setShowLinkExisting(false);
            refetchAll();
          }}
        />
      )}
    </>
  );
}

// ─── Main ControlDetail ─────────────────────────────────────────────────────

export function ControlDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showEditDialog, setShowEditDialog] = useState(false);

  const { data: control, isLoading } = useQuery({
    queryKey: ["applied-control", id],
    queryFn: () => controlsApi.getAppliedControl(id!),
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => controlsApi.deleteAppliedControl(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applied-controls"] });
      navigate("/controls");
    },
  });

  if (isLoading) return <LoadingSpinner />;
  if (!control) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Control not found</p>
      </div>
    );
  }

  const statusInfo =
    CONTROL_STATUS[control.status as keyof typeof CONTROL_STATUS];
  const frameworks: string[] = control.frameworks ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/controls")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold text-gray-900">
                {control.reference_control_code}
              </h1>
              {/* Framework badges — shows e.g. "ISO-27001" "TISAX" */}
              {frameworks.map((fw) => (
                <FrameworkBadge key={fw} code={fw} />
              ))}
            </div>
            <p className="text-gray-600 mt-1">
              {control.reference_control_name}
            </p>
            {frameworks.length > 1 && (
              <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                <Layers className="h-3 w-3" />
                Evidence linked here counts toward all {frameworks.length}{" "}
                frameworks
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowEditDialog(true)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm("Delete this control?")) deleteMutation.mutate();
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
              Status
            </p>
            <Badge className={statusInfo?.color}>
              {statusInfo?.label ?? control.status}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
              Compliance Score
            </p>
            <p className="text-2xl font-bold text-gray-900">
              {control.compliance_score}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
              Effectiveness
            </p>
            <p className="text-2xl font-bold text-gray-900">
              {control.effectiveness_rating != null
                ? `${control.effectiveness_rating}%`
                : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
              Evidence Files
            </p>
            <p className="text-2xl font-bold text-gray-900">
              {control.evidence_count}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Control Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {control.department_name && (
              <div className="flex items-center gap-3">
                <Shield className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Department</p>
                  <p className="text-sm font-medium">
                    {control.department_name}
                  </p>
                </div>
              </div>
            )}
            {control.control_owner_email && (
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Control Owner</p>
                  <p className="text-sm font-medium">
                    {control.control_owner_email}
                  </p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Next Review</p>
                <p className="text-sm font-medium">
                  {control.next_review_date
                    ? formatDate(control.next_review_date)
                    : "Not scheduled"}
                </p>
                {control.is_overdue && (
                  <Badge variant="destructive" className="mt-1">
                    Overdue
                  </Badge>
                )}
              </div>
            </div>
            {control.last_tested_date && (
              <div className="flex items-center gap-3">
                <CheckCircle className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Last Tested</p>
                  <p className="text-sm font-medium">
                    {formatDate(control.last_tested_date)}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Implementation Notes</CardTitle>
          </CardHeader>
          <CardContent>
            {control.implementation_notes ? (
              <p className="text-gray-700 whitespace-pre-wrap text-sm">
                {control.implementation_notes}
              </p>
            ) : (
              <p className="text-gray-400 italic text-sm">No notes added yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Deficiencies */}
      {control.has_deficiencies && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-medium text-red-900">
                  Control Has Deficiencies
                </h3>
                <p className="text-sm text-red-700 mt-1">
                  This control has identified deficiencies requiring
                  remediation.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Evidence Panel */}
      <EvidencePanel controlId={id!} />

      {/* Edit dialog */}
      {showEditDialog && (
        <EditControlDialog
          control={control}
          open={showEditDialog}
          onClose={() => setShowEditDialog(false)}
          onSuccess={() => {
            setShowEditDialog(false);
            queryClient.invalidateQueries({
              queryKey: ["applied-control", id],
            });
          }}
        />
      )}
    </div>
  );
}
