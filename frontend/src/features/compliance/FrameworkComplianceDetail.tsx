/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import {
  ArrowLeft,
  RefreshCw,
  FileText,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Target,
  BarChart2,
} from "lucide-react";
import { COMPLIANCE_STATUS } from "../../lib/constants";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { GapAnalysis } from "./GapAnalysis";
import { ComplianceRecommendations } from "./ComplianceRecommendations";
import type { ComplianceResult } from "../../types/compliance.types.ts";

export function FrameworkComplianceDetail() {
  const { frameworkId } = useParams<{ frameworkId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<
    "overview" | "gaps" | "requirements" | "recommendations"
  >("overview");

  const { data: currentResults, isLoading: resultsLoading } = useQuery({
    queryKey: ["compliance-results", frameworkId],
    queryFn: () =>
      complianceApi.getResults({
        framework: frameworkId,
        is_current: true,
        page_size: 1,
      }),
    enabled: !!frameworkId,
  });

  const { data: trends } = useQuery({
    queryKey: ["compliance-trends", frameworkId],
    queryFn: () => complianceApi.getTrends(frameworkId!, 12),
    enabled: !!frameworkId,
  });

  const calculateMutation = useMutation({
    mutationFn: () => complianceApi.calculate(frameworkId!),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["compliance-results", frameworkId],
      });
      queryClient.invalidateQueries({
        queryKey: ["compliance-trends", frameworkId],
      });
    },
  });

  if (resultsLoading) {
    return <LoadingSpinner />;
  }

  const result = currentResults?.results?.[0];

  const tabs = [
    { id: "overview", label: "Overview", icon: BarChart2 },
    { id: "gaps", label: "Gap Analysis", icon: AlertCircle },
    { id: "requirements", label: "Requirements", icon: CheckCircle },
    { id: "recommendations", label: "Recommendations", icon: Target },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/compliance")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-gray-900">
                {result?.framework_code || "Framework"}
              </h1>
              {result && (
                <Badge
                  className={
                    COMPLIANCE_STATUS[
                      result.compliance_status as keyof typeof COMPLIANCE_STATUS
                    ]?.color
                  }
                >
                  {
                    COMPLIANCE_STATUS[
                      result.compliance_status as keyof typeof COMPLIANCE_STATUS
                    ]?.label
                  }
                </Badge>
              )}
            </div>
            <p className="text-gray-600 mt-1">{result?.framework_name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => calculateMutation.mutate()}
            disabled={calculateMutation.isPending}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${calculateMutation.isPending ? "animate-spin" : ""}`}
            />
            Recalculate
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/compliance/reports")}
          >
            <FileText className="mr-2 h-4 w-4" />
            Generate Report
          </Button>
        </div>
      </div>

      {/* No Results State */}
      {!result ? (
        <Card>
          <CardContent className="text-center py-16">
            <BarChart2 className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-lg">No compliance results yet</p>
            <p className="text-gray-400 mt-2">
              Run a calculation to see your compliance status
            </p>
            <Button
              className="mt-6"
              onClick={() => calculateMutation.mutate()}
              disabled={calculateMutation.isPending}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${calculateMutation.isPending ? "animate-spin" : ""}`}
              />
              {calculateMutation.isPending ? "Calculating..." : "Calculate Now"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Score Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            {/* Grade */}
            <Card className="md:col-span-1">
              <CardContent className="p-6 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-600 mb-2">
                    Grade
                  </p>
                  <div
                    className={`h-20 w-20 rounded-full flex items-center justify-center text-3xl font-bold mx-auto ${
                      result.compliance_grade?.startsWith("A")
                        ? "bg-green-100 text-green-700"
                        : result.compliance_grade?.startsWith("B")
                          ? "bg-blue-100 text-blue-700"
                          : result.compliance_grade?.startsWith("C")
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-red-100 text-red-700"
                    }`}
                  >
                    {result.compliance_grade}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-gray-600">
                  Compliance Score
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {parseFloat(result.compliance_score as any).toFixed(1)}%
                </p>
                <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full"
                    style={{ width: `${result.compliance_score}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-gray-600">Coverage</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {parseFloat(result.coverage_percentage as any).toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {result.requirements_compliant} / {result.total_requirements}{" "}
                  requirements
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-gray-600">
                  Controls Active
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {result.controls_operational}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  of {result.total_controls} total
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-gray-600">Open Gaps</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {result.gap_count}
                </p>
                {result.gap_count > 0 && (
                  <Button
                    variant="link"
                    className="p-0 h-auto text-xs text-primary mt-1"
                    onClick={() => setActiveTab("gaps")}
                  >
                    View gaps →
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === tab.id
                        ? "border-primary text-primary"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Tab Content */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Requirements Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Requirements Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {[
                      {
                        label: "Compliant",
                        value: result.requirements_compliant,
                        color: "bg-green-500",
                      },
                      {
                        label: "Partially Compliant",
                        value: result.requirements_partial,
                        color: "bg-yellow-500",
                      },
                      {
                        label: "Non-Compliant",
                        value: result.requirements_non_compliant,
                        color: "bg-red-500",
                      },
                    ].map((item) => (
                      <div key={item.label}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">{item.label}</span>
                          <span className="font-medium">
                            {item.value} / {result.total_requirements}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`${item.color} h-2 rounded-full`}
                            style={{
                              width: `${(item.value / (result.total_requirements || 1)) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Controls Status</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {[
                      {
                        label: "Operational",
                        value: result.controls_operational,
                        color: "bg-green-500",
                      },
                      {
                        label: "Implemented",
                        value: result.controls_implemented,
                        color: "bg-blue-500",
                      },
                      {
                        label: "In Progress",
                        value: result.controls_in_progress,
                        color: "bg-yellow-500",
                      },
                      {
                        label: "Not Started",
                        value: result.controls_not_started,
                        color: "bg-gray-400",
                      },
                    ].map((item) => (
                      <div key={item.label}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">{item.label}</span>
                          <span className="font-medium">{item.value}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`${item.color} h-2 rounded-full`}
                            style={{
                              width: `${(item.value / (result.total_controls || 1)) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              {/* Trend Chart */}
              {trends && trends.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Compliance Trend</CardTitle>
                    <CardDescription>Score over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart
                        data={trends}
                        margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                        <Tooltip
                          formatter={(v: any) => [
                            `${parseFloat(v).toFixed(1)}%`,
                          ]}
                          contentStyle={{ borderRadius: 8 }}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="compliance_score"
                          name="Compliance Score"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          dot={{ r: 4 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="coverage_percentage"
                          name="Coverage"
                          stroke="#10b981"
                          strokeWidth={2}
                          dot={{ r: 4 }}
                          strokeDasharray="5 5"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {activeTab === "gaps" && <GapAnalysis frameworkId={frameworkId!} />}

          {activeTab === "requirements" && (
            <RequirementsBreakdown result={result} />
          )}

          {activeTab === "recommendations" && (
            <ComplianceRecommendations frameworkId={frameworkId!} />
          )}
        </>
      )}
    </div>
  );
}

/* Requirements Breakdown Component */
function RequirementsBreakdown({ result }: { result: ComplianceResult }) {
  const requirementDetails = result.requirement_details || {};
  const entries = Object.entries(requirementDetails);

  const statusColors: Record<string, string> = {
    compliant: "bg-green-100 text-green-800",
    partial: "bg-yellow-100 text-yellow-800",
    non_compliant: "bg-red-100 text-red-800",
    not_implemented: "bg-gray-100 text-gray-800",
    no_controls: "bg-orange-100 text-orange-800",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Requirements Detail</CardTitle>
        <CardDescription>
          Compliance status for each requirement ({entries.length})
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {entries.map(([reqId, req]: [string, any]) => (
            <div
              key={reqId}
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">{req.code}</p>
                    <Badge
                      className={
                        statusColors[req.status] || "bg-gray-100 text-gray-800"
                      }
                    >
                      {req.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{req.title}</p>

                  {req.controls && req.controls.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {req.controls.map((ctrl: any) => (
                        <span
                          key={ctrl.id}
                          className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-full"
                        >
                          {ctrl.code} ({ctrl.score}%)
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm font-medium text-gray-900">
                    {req.score?.toFixed(0) || 0}%
                  </span>
                  <div className="w-16 bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        (req.score || 0) >= 85
                          ? "bg-green-500"
                          : (req.score || 0) >= 50
                            ? "bg-yellow-500"
                            : "bg-red-500"
                      }`}
                      style={{ width: `${req.score || 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
