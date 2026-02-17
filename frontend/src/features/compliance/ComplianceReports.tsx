import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { complianceApi } from "../../api/compliance";
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
import { FileText, Download, Plus, BarChart2 } from "lucide-react";
import { formatDateTime } from "../../lib/utils";
import { getErrorMessage } from "../../api/client";

export function ComplianceReports() {
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    framework: "",
    report_type: "summary",
    report_format: "pdf",
    period_start: "",
    period_end: "",
  });

  const {
    data: reports,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["compliance-reports"],
    queryFn: complianceApi.getReports,
  });

  const { data: frameworks } = useQuery({
    queryKey: ["frameworks"],
    queryFn: complianceApi.getFrameworks,
  });

  const generateMutation = useMutation({
    mutationFn: complianceApi.generateReport,
    onSuccess: () => {
      refetch();
      setShowGenerateForm(false);
      setFormData({
        title: "",
        framework: "",
        report_type: "summary",
        report_format: "pdf",
        period_start: "",
        period_end: "",
      });
    },
  });

  const handleDownload = async (reportId: string, title: string) => {
    try {
      const blob = await complianceApi.downloadReport(reportId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  const reportTypes = [
    { value: "summary", label: "Executive Summary" },
    { value: "detailed", label: "Detailed Assessment" },
    { value: "gap_analysis", label: "Gap Analysis" },
    { value: "evidence_matrix", label: "Evidence Matrix" },
    { value: "control_matrix", label: "Control Matrix" },
    { value: "audit_report", label: "Audit Report" },
  ];

  const statusColors: Record<string, string> = {
    pending: "bg-gray-100 text-gray-800",
    generating: "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-600 mt-1">
            Generate and manage compliance reports
          </p>
        </div>
        <Button onClick={() => setShowGenerateForm(!showGenerateForm)}>
          <Plus className="mr-2 h-4 w-4" />
          Generate Report
        </Button>
      </div>

      {/* Generate Form */}
      {showGenerateForm && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>Generate New Report</CardTitle>
          </CardHeader>
          <CardContent>
            {generateMutation.error && (
              <div className="p-3 mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                {getErrorMessage(generateMutation.error)}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 space-y-2">
                <label className="text-sm font-medium">Report Title *</label>
                <Input
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="Q4 2024 Compliance Report"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Framework</label>
                <select
                  value={formData.framework}
                  onChange={(e) =>
                    setFormData({ ...formData, framework: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">All Frameworks</option>
                  {frameworks?.results?.map((f: any) => (
                    <option key={f.id} value={f.id}>
                      {f.code} - {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Report Type *</label>
                <select
                  value={formData.report_type}
                  onChange={(e) =>
                    setFormData({ ...formData, report_type: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {reportTypes.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Period Start</label>
                <Input
                  type="date"
                  value={formData.period_start}
                  onChange={(e) =>
                    setFormData({ ...formData, period_start: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Period End</label>
                <Input
                  type="date"
                  value={formData.period_end}
                  onChange={(e) =>
                    setFormData({ ...formData, period_end: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                onClick={() => generateMutation.mutate(formData)}
                disabled={!formData.title || generateMutation.isPending}
              >
                {generateMutation.isPending ? "Generating..." : "Generate"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowGenerateForm(false)}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reports List */}
      <Card>
        <CardHeader>
          <CardTitle>Generated Reports</CardTitle>
          <CardDescription>
            {reports?.count || 0} reports generated
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!reports?.results || reports.results.length === 0 ? (
            <div className="text-center py-12">
              <BarChart2 className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No reports generated yet</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setShowGenerateForm(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Generate Your First Report
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-gray-700">
                      Title
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">
                      Framework
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">
                      Type
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">
                      Generated
                    </th>
                    <th className="text-right py-3 px-4 font-medium text-gray-700">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {reports.results.map((report: any) => (
                    <tr
                      key={report.id}
                      className="border-b hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-gray-400 flex-shrink-0" />
                          <p className="font-medium text-gray-900">
                            {report.title}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-600">
                          {report.framework_code || "All"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-600 capitalize">
                          {report.report_type.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          className={
                            statusColors[report.generation_status] || ""
                          }
                        >
                          {report.generation_status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-600">
                          {formatDateTime(report.created_at)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-end">
                          {report.generation_status === "completed" &&
                            report.report_file && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  handleDownload(report.id, report.title)
                                }
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
