import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
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
import { Input } from "../../components/ui/input";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import {
  Plus,
  Search,
  Filter,
  Eye,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { EVIDENCE_STATUS } from "../../lib/constants";
import { formatDate, formatFileSize } from "../../lib/utils";
import { UploadEvidenceDialog } from "./UploadEvidenceDialog";
import type { Evidence } from "../../types/evidence.types";

export function EvidenceList() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [showUploadDialog, setShowUploadDialog] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["evidence-list", page, search, statusFilter, typeFilter],
    queryFn: () =>
      evidenceApi.getEvidenceList({
        page,
        page_size: 20,
        search: search || undefined,
        verification_status: statusFilter || undefined,
        evidence_type: typeFilter || undefined,
      }),
  });

  const { data: analytics } = useQuery({
    queryKey: ["evidence-analytics"],
    queryFn: evidenceApi.getAnalytics,
  });

  const handleDownload = async (evidence: Evidence) => {
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

  const evidenceTypes = [
    "policy",
    "procedure",
    "screenshot",
    "report",
    "log",
    "certificate",
    "configuration",
    "scan_result",
    "audit_report",
    "training_record",
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Evidence</h1>
          <p className="text-gray-600 mt-1">
            Manage compliance evidence and documentation
          </p>
        </div>
        <Button onClick={() => setShowUploadDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Upload Evidence
        </Button>
      </div>

      {/* Storage Usage */}
      {analytics && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-gray-600">Storage Used</span>
                  <span className="font-medium">
                    {analytics.storage.used_mb.toFixed(2)} MB /{" "}
                    {analytics.storage.quota_mb} MB
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${
                      analytics.storage.is_over_quota
                        ? "bg-red-500"
                        : analytics.storage.usage_percentage > 80
                          ? "bg-yellow-500"
                          : "bg-green-500"
                    }`}
                    style={{
                      width: `${Math.min(analytics.storage.usage_percentage, 100)}%`,
                    }}
                  />
                </div>
              </div>
              {analytics.storage.is_over_quota && (
                <div className="ml-6">
                  <Badge variant="destructive">Over Quota</Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Total Evidence
                  </p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {analytics.total_evidence}
                  </p>
                </div>
                <FileText className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Pending Approval
                  </p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {analytics.by_status.find(
                      (s) => s.verification_status === "pending",
                    )?.count || 0}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Expired</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {analytics.expired_count}
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Unlinked</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {analytics.unlinked_count}
                  </p>
                </div>
                <XCircle className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search evidence..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>

            {/* Type filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-600">Type:</span>
              {evidenceTypes.slice(0, 5).map((type) => (
                <Button
                  key={type}
                  variant={typeFilter === type ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setTypeFilter(typeFilter === type ? "" : type);
                    setPage(1);
                  }}
                >
                  {type.replace("_", " ")}
                </Button>
              ))}
            </div>

            {/* Status filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-600">Status:</span>
              {(["pending", "approved", "rejected"] as const).map((status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setStatusFilter(statusFilter === status ? "" : status);
                    setPage(1);
                  }}
                >
                  {EVIDENCE_STATUS[status].label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Evidence Table */}
      <Card>
        <CardHeader>
          <CardTitle>Evidence Files</CardTitle>
          <CardDescription>{data?.count || 0} files found</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingSpinner />
          ) : data?.results.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No evidence found</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setShowUploadDialog(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Upload Your First Evidence
              </Button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-gray-700">
                        Name
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">
                        Type
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">
                        Size
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">
                        Status
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">
                        Controls
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">
                        Uploaded
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-gray-700">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.results.map((evidence) => (
                      <tr
                        key={evidence.id}
                        className="border-b hover:bg-gray-50 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                              <FileText className="h-5 w-5 text-blue-600" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900 truncate">
                                {evidence.name}
                              </p>
                              <p className="text-sm text-gray-500 truncate">
                                {evidence.file_extension.toUpperCase()}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm text-gray-600 capitalize">
                            {evidence.evidence_type.replace("_", " ")}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm text-gray-600">
                            {evidence.file_size_display}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            className={
                              EVIDENCE_STATUS[
                                evidence.verification_status as keyof typeof EVIDENCE_STATUS
                              ]?.color
                            }
                          >
                            {
                              EVIDENCE_STATUS[
                                evidence.verification_status as keyof typeof EVIDENCE_STATUS
                              ]?.label
                            }
                          </Badge>
                          {evidence.is_expired && (
                            <Badge variant="destructive" className="ml-2">
                              Expired
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div
                              className={`h-2 w-2 rounded-full ${
                                evidence.linked_controls_count > 0
                                  ? "bg-green-500"
                                  : "bg-gray-300"
                              }`}
                            />
                            <span className="text-sm text-gray-600">
                              {evidence.linked_controls_count}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-sm text-gray-900">
                            {formatDate(evidence.created_at)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {evidence.uploaded_by_email}
                          </p>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                navigate(`/evidence/${evidence.id}`)
                              }
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDownload(evidence)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {data && data.count > 20 && (
                <div className="flex items-center justify-between mt-6">
                  <p className="text-sm text-gray-600">
                    Showing {(page - 1) * 20 + 1} to{" "}
                    {Math.min(page * 20, data.count)} of {data.count} files
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setPage(page - 1)}
                      disabled={!data.previous}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setPage(page + 1)}
                      disabled={!data.next}
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

      {/* Upload Dialog */}
      <UploadEvidenceDialog
        open={showUploadDialog}
        onClose={() => setShowUploadDialog(false)}
        onSuccess={() => {
          setShowUploadDialog(false);
          refetch();
        }}
      />
    </div>
  );
}
