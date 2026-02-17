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
} from "lucide-react";
import { EVIDENCE_STATUS } from "../../lib/constants";
import { formatDate, formatDateTime } from "../../lib/utils";
import { EvidenceViewer } from "./EvidenceViewer";
import { LinkControlsDialog } from "./LinkControlsDialog";
import { EvidenceComments } from "./EvidenceComments";

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

  const deleteMutation = useMutation({
    mutationFn: () => evidenceApi.deleteEvidence(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evidence-list"] });
      navigate("/evidence");
    },
  });

  const approveMutation = useMutation({
    mutationFn: () => evidenceApi.approveEvidence(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evidence", id] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => evidenceApi.rejectEvidence(id!, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evidence", id] });
    },
  });

  const handleDownload = async () => {
    if (!evidence) return;

    try {
      const blob = await evidenceApi.downloadEvidence(evidence.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = evidence.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!evidence) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Evidence not found</p>
      </div>
    );
  }

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
            <h1 className="text-3xl font-bold text-gray-900">
              {evidence.name}
            </h1>
            <p className="text-gray-600 mt-1">
              {evidence.file_extension.toUpperCase()} •{" "}
              {evidence.file_size_display}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>

          {evidence.verification_status === "pending" && (
            <>
              <Button
                variant="outline"
                onClick={() => approveMutation.mutate()}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Approve
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const reason = prompt("Rejection reason:");
                  if (reason) rejectMutation.mutate(reason);
                }}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
            </>
          )}

          <Button
            variant="destructive"
            onClick={() => {
              if (confirm("Are you sure you want to delete this evidence?")) {
                deleteMutation.mutate();
              }
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div>
              <p className="text-sm font-medium text-gray-600">Status</p>
              <Badge
                className={`mt-2 ${
                  EVIDENCE_STATUS[
                    evidence.verification_status as keyof typeof EVIDENCE_STATUS
                  ]?.color
                }`}
              >
                {
                  EVIDENCE_STATUS[
                    evidence.verification_status as keyof typeof EVIDENCE_STATUS
                  ]?.label
                }
              </Badge>
              {evidence.is_expired && (
                <Badge variant="destructive" className="ml-2 mt-2">
                  Expired
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div>
              <p className="text-sm font-medium text-gray-600">Type</p>
              <p className="text-lg font-semibold text-gray-900 mt-2 capitalize">
                {evidence.evidence_type.replace("_", " ")}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div>
              <p className="text-sm font-medium text-gray-600">
                Linked Controls
              </p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {evidence.linked_controls_count}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div>
              <p className="text-sm font-medium text-gray-600">Version</p>
              <p className="text-lg font-semibold text-gray-900 mt-2">
                {evidence.version}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Evidence Viewer */}
        <div className="lg:col-span-2">
          <EvidenceViewer evidence={evidence} />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Details */}
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Uploaded By
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <User className="h-4 w-4 text-gray-400" />
                  <p className="text-gray-900">
                    {evidence.uploaded_by_email || "Unknown"}
                  </p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">
                  Upload Date
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <p className="text-gray-900">
                    {formatDateTime(evidence.created_at)}
                  </p>
                </div>
              </div>

              {evidence.validity_end_date && (
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Valid Until
                  </label>
                  <div className="flex items-center gap-2 mt-1">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <p className="text-gray-900">
                      {formatDate(evidence.validity_end_date)}
                    </p>
                  </div>
                </div>
              )}

              {evidence.tags.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Tags
                  </label>
                  <div className="flex flex-wrap gap-2 mt-1">
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
                  <p className="text-sm text-yellow-800 font-medium">
                    🔒 Confidential Document
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Description */}
          {evidence.description && (
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 whitespace-pre-wrap">
                  {evidence.description}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Linked Controls */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Linked Controls</CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowLinkDialog(true)}
                >
                  <LinkIcon className="mr-2 h-4 w-4" />
                  Link
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {links && links.results.length > 0 ? (
                <div className="space-y-3">
                  {links.results.map((link) => (
                    <div
                      key={link.id}
                      className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900">
                            {link.control_code}
                          </p>
                          <p className="text-sm text-gray-600 truncate">
                            {link.control_name}
                          </p>
                          <Badge variant="secondary" className="mt-1">
                            {link.link_type.replace("_", " ")}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Shield className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No controls linked</p>
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

      {/* Link Controls Dialog */}
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
