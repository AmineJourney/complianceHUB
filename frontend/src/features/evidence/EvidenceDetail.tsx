/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  Download,
  Trash2,
  CheckCircle,
  XCircle,
  FileText,
  Calendar,
  User,
  Shield,
  MessageSquare,
  Link as LinkIcon,
  RefreshCw,
  Clock,
  Layers,
} from "lucide-react";
import { EVIDENCE_STATUS } from "../../lib/constants";
import { formatDate, formatDateTime } from "../../lib/utils";
import { EvidenceViewer } from "./EvidenceViewer";
import { LinkControlsDialog } from "./LinkControlsDialog";
import { EvidenceComments } from "./EvidenceComments";
import type { AppliedControlEvidence } from "../../types/evidence.types";

// ─── Framework pill colours ────────────────────────────────────────────────

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

// ─── Coverage summary banner ───────────────────────────────────────────────
// Shows: "This evidence covers N controls across X frameworks (ISO 27001, TISAX)"

function FrameworkCoverageBanner({
  links,
}: {
  links: AppliedControlEvidence[];
}) {
  if (links.length === 0) return null;

  const allFrameworks = Array.from(
    new Set(links.flatMap((l) => l.frameworks ?? [])),
  ).sort();

  if (allFrameworks.length === 0) return null;

  return (
    <div className="flex items-start gap-3 p-4 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl">
      <Layers className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-sm font-semibold text-gray-900">
          Multi-framework coverage
        </p>
        <p className="text-sm text-gray-600 mt-0.5">
          This evidence supports{" "}
          <span className="font-medium">
            {links.length} control{links.length !== 1 ? "s" : ""}
          </span>{" "}
          and satisfies requirements across{" "}
          <span className="font-medium">
            {allFrameworks.length} framework
            {allFrameworks.length !== 1 ? "s" : ""}
          </span>
          . Upload it once — compliance everywhere.
        </p>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {allFrameworks.map((fw) => (
            <FrameworkBadge key={fw} code={fw} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Linked control row ────────────────────────────────────────────────────

function LinkedControlRow({
  link,
  onUnlink,
}: {
  link: AppliedControlEvidence;
  onUnlink: () => void;
}) {
  const navigate = useNavigate();
  const frameworks = link.frameworks ?? [];

  return (
    <div className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 group transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Shield className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-semibold text-sm text-gray-900">
                {link.control_code}
              </span>
              <Badge variant="secondary" className="text-xs capitalize">
                {link.link_type.replace("_", " ")}
              </Badge>
            </div>
            <p className="text-sm text-gray-500 truncate mt-0.5">
              {link.control_name}
            </p>
            {/* Framework badges for this specific control */}
            {frameworks.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {frameworks.map((fw) => (
                  <FrameworkBadge key={fw} code={fw} />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-gray-500 hover:text-primary"
            onClick={() => navigate(`/controls/${link.applied_control}`)}
          >
            View
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-gray-500 hover:text-red-600"
            onClick={onUnlink}
          >
            Unlink
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main EvidenceDetail ───────────────────────────────────────────────────

export function EvidenceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showLinkDialog, setShowLinkDialog] = useState(false);

  const { data: evidence, isLoading } = useQuery({
    queryKey: ["evidence", id],
    queryFn: () => evidenceApi.getEvidence(id!),
    enabled: !!id,
  });

  const { data: links } = useQuery({
    queryKey: ["evidence-links", id],
    queryFn: () => evidenceApi.getControlEvidenceLinks({ evidence: id }),
    enabled: !!id,
  });

  const unlinkMutation = useMutation({
    mutationFn: (linkId: string) =>
      evidenceApi.deleteControlEvidenceLink(linkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evidence-links", id] });
      queryClient.invalidateQueries({ queryKey: ["evidence", id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => evidenceApi.deleteEvidence(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evidence-list"] });
      navigate("/evidence");
    },
  });

  const approveMutation = useMutation({
    mutationFn: () => evidenceApi.approveEvidence(id!),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["evidence", id] }),
  });

  const handleDownload = async () => {
    if (!evidence) return;
    try {
      const blob = await evidenceApi.downloadEvidence(id!);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = evidence.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      console.error("Download failed", e);
    }
  };

  if (isLoading) return <LoadingSpinner />;
  if (!evidence) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Evidence not found</p>
      </div>
    );
  }

  const statusInfo =
    EVIDENCE_STATUS[
      evidence.verification_status as keyof typeof EVIDENCE_STATUS
    ];
  const linkedItems = links?.results ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/evidence")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {evidence.name}
            </h1>
            <p className="text-gray-500 text-sm mt-0.5 capitalize">
              {evidence.evidence_type.replace("_", " ")} ·{" "}
              {evidence.file_size_display} · v{evidence.version}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {evidence.verification_status === "pending" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
            >
              <CheckCircle className="mr-1.5 h-4 w-4 text-green-600" />
              Approve
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="mr-1.5 h-4 w-4" />
            Download
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              if (confirm("Delete this evidence permanently?"))
                deleteMutation.mutate();
            }}
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
              Status
            </p>
            <Badge className={statusInfo?.color}>{statusInfo?.label}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
              Controls
            </p>
            <p className="text-2xl font-bold text-gray-900">
              {linkedItems.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
              Frameworks
            </p>
            <p className="text-2xl font-bold text-gray-900">
              {new Set(linkedItems.flatMap((l) => l.frameworks ?? [])).size}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
              Valid
            </p>
            <p className="text-2xl font-bold text-gray-900">
              {evidence.is_expired
                ? "❌ Expired"
                : evidence.is_valid
                  ? "✓"
                  : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Multi-framework coverage banner — only shows when >1 framework */}
      {linkedItems.length > 0 &&
        new Set(linkedItems.flatMap((l) => l.frameworks ?? [])).size > 1 && (
          <FrameworkCoverageBanner links={linkedItems} />
        )}

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Viewer */}
        <div className="lg:col-span-2 space-y-6">
          <EvidenceViewer evidence={evidence} />

          {/* Description */}
          {evidence.description && (
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 whitespace-pre-wrap text-sm">
                  {evidence.description}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <User className="h-4 w-4 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">Uploaded by</p>
                  <p className="font-medium">
                    {evidence.uploaded_by_email ?? "Unknown"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">Uploaded</p>
                  <p className="font-medium">
                    {formatDateTime(evidence.created_at)}
                  </p>
                </div>
              </div>
              {evidence.validity_end_date && (
                <div className="flex items-start gap-3">
                  <Clock className="h-4 w-4 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">Valid until</p>
                    <p
                      className={`font-medium ${evidence.is_expired ? "text-red-600" : ""}`}
                    >
                      {formatDate(evidence.validity_end_date)}
                    </p>
                  </div>
                </div>
              )}
              {evidence.tags.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-1.5">Tags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {evidence.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {evidence.is_confidential && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <p className="text-xs text-yellow-800 font-medium">
                    🔒 Confidential — restricted access
                  </p>
                </div>
              )}
              {evidence.verification_status === "approved" &&
                evidence.verified_by_email && (
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500">Approved by</p>
                      <p className="font-medium">
                        {evidence.verified_by_email}
                      </p>
                    </div>
                  </div>
                )}
            </CardContent>
          </Card>

          {/* Linked controls — with framework badges per row */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Linked Controls
                  </CardTitle>
                  <CardDescription className="mt-0.5">
                    {linkedItems.length > 0
                      ? `Covers ${new Set(linkedItems.flatMap((l) => l.frameworks ?? [])).size} framework(s)`
                      : "No controls linked yet"}
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowLinkDialog(true)}
                >
                  <LinkIcon className="mr-1.5 h-3.5 w-3.5" />
                  Link
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {linkedItems.length === 0 ? (
                <div className="text-center py-6">
                  <Shield className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">
                    Link this evidence to controls to contribute to compliance
                    scores in any framework.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => setShowLinkDialog(true)}
                  >
                    Link controls
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {linkedItems.map((link) => (
                    <LinkedControlRow
                      key={link.id}
                      link={link}
                      onUnlink={() => unlinkMutation.mutate(link.id)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Comments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Comments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EvidenceComments evidenceId={evidence.id} />
        </CardContent>
      </Card>

      {/* Link controls dialog */}
      <LinkControlsDialog
        evidenceId={evidence.id}
        open={showLinkDialog}
        onClose={() => setShowLinkDialog(false)}
        onSuccess={() => {
          setShowLinkDialog(false);
          queryClient.invalidateQueries({ queryKey: ["evidence-links", id] });
        }}
      />
    </div>
  );
}
