/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
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
  CheckSquare,
  TrendingUp,
  AlertCircle,
  Award,
  RefreshCw,
  ChevronRight,
  Target,
  BarChart2,
  FileText,
} from "lucide-react";
import { COMPLIANCE_STATUS } from "../../lib/constants";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { AdoptFrameworkDialog } from "./AdoptFrameworkDialog";

export function ComplianceDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showAdoptDialog, setShowAdoptDialog] = useState(false);

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ["compliance-overview"],
    queryFn: complianceApi.getOverview,
  });

  const { data: adoptions } = useQuery({
    queryKey: ["framework-adoptions"],
    queryFn: complianceApi.getActiveAdoptions,
  });

  const { data: openGaps } = useQuery({
    queryKey: ["open-gaps"],
    queryFn: complianceApi.getOpenGaps,
  });

  const { data: expiringSoon } = useQuery({
    queryKey: ["expiring-certifications"],
    queryFn: complianceApi.getExpiringSoon,
  });

  const calculateAllMutation = useMutation({
    mutationFn: complianceApi.calculateAll,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compliance-overview"] });
    },
  });

  if (overviewLoading) {
    return <LoadingSpinner />;
  }

  // Prepare radar chart data from framework scores
  const radarData =
    overview?.frameworks?.map((f: any) => ({
      framework: f.framework_code,
      score: f.compliance_score,
    })) || [];

  // Prepare bar chart data from framework scores
  const barData =
    overview?.frameworks?.map((f: any) => ({
      name: f.framework_code,
      score: parseFloat(f.compliance_score.toFixed(1)),
      coverage: parseFloat(f.coverage_percentage.toFixed(1)),
    })) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Compliance</h1>
          <p className="text-gray-600 mt-1">
            Monitor your compliance posture across all frameworks
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => calculateAllMutation.mutate()}
            disabled={calculateAllMutation.isPending}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${calculateAllMutation.isPending ? "animate-spin" : ""}`}
            />
            Recalculate All
          </Button>
          <Button onClick={() => setShowAdoptDialog(true)}>
            <CheckSquare className="mr-2 h-4 w-4" />
            Adopt Framework
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Avg Compliance Score
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {overview?.avg_compliance_score?.toFixed(1) || 0}%
                </p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Frameworks</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {overview?.total_frameworks || 0}
                </p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center">
                <CheckSquare className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Open Gaps</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {openGaps?.count || 0}
                </p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-red-100 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Certifications
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {adoptions?.filter((a: any) => a.is_certified).length || 0}
                </p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center">
                <Award className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compliance Score Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Compliance by Framework</CardTitle>
            <CardDescription>Score and coverage comparison</CardDescription>
          </CardHeader>
          <CardContent>
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={barData}
                  margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: any) => [`${value}%`]}
                    contentStyle={{ borderRadius: 8 }}
                  />
                  <Bar
                    dataKey="score"
                    name="Compliance Score"
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="coverage"
                    name="Coverage"
                    fill="#93c5fd"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                No compliance data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Radar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Compliance Radar</CardTitle>
            <CardDescription>
              Visual posture across all frameworks
            </CardDescription>
          </CardHeader>
          <CardContent>
            {radarData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="framework" tick={{ fontSize: 12 }} />
                  <Radar
                    name="Score"
                    dataKey="score"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.2}
                  />
                  <Tooltip formatter={(v: any) => [`${v}%`]} />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                No compliance data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Frameworks List */}
      <Card>
        <CardHeader>
          <CardTitle>Framework Status</CardTitle>
          <CardDescription>
            Current compliance status per framework
          </CardDescription>
        </CardHeader>
        <CardContent>
          {overview?.frameworks && overview.frameworks.length > 0 ? (
            <div className="space-y-3">
              {overview.frameworks.map((framework: any) => (
                <div
                  key={framework.framework_id}
                  className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() =>
                    navigate(`/compliance/frameworks/${framework.framework_id}`)
                  }
                >
                  {/* Framework Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <p className="font-semibold text-gray-900">
                        {framework.framework_code}
                      </p>
                      <p className="text-sm text-gray-600 truncate">
                        {framework.framework_name}
                      </p>
                    </div>
                  </div>

                  {/* Score */}
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Coverage</p>
                      <p className="font-semibold text-gray-900">
                        {framework.coverage_percentage?.toFixed(1)}%
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm text-gray-500">Score</p>
                      <p className="font-semibold text-gray-900">
                        {framework.compliance_score?.toFixed(1)}%
                      </p>
                    </div>

                    {/* Grade Badge */}
                    <div
                      className={`h-12 w-12 rounded-full flex items-center justify-center font-bold text-lg ${
                        framework.grade?.startsWith("A")
                          ? "bg-green-100 text-green-700"
                          : framework.grade?.startsWith("B")
                            ? "bg-blue-100 text-blue-700"
                            : framework.grade?.startsWith("C")
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-red-100 text-red-700"
                      }`}
                    >
                      {framework.grade}
                    </div>

                    {/* Status */}
                    <Badge
                      className={
                        COMPLIANCE_STATUS[
                          framework.status as keyof typeof COMPLIANCE_STATUS
                        ]?.color
                      }
                    >
                      {
                        COMPLIANCE_STATUS[
                          framework.status as keyof typeof COMPLIANCE_STATUS
                        ]?.label
                      }
                    </Badge>

                    {/* Gaps */}
                    {framework.gap_count > 0 && (
                      <Badge variant="destructive">
                        {framework.gap_count} gaps
                      </Badge>
                    )}

                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <CheckSquare className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No frameworks adopted yet</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setShowAdoptDialog(true)}
              >
                <CheckSquare className="mr-2 h-4 w-4" />
                Adopt Your First Framework
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Items */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expiring Certifications */}
        {expiringSoon && expiringSoon.length > 0 && (
          <Card className="border-yellow-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-800">
                <Award className="h-5 w-5" />
                Certifications Expiring Soon
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {expiringSoon.map((adoption: any) => (
                  <div
                    key={adoption.id}
                    className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {adoption.framework_code}
                      </p>
                      <p className="text-sm text-gray-600">
                        Expires: {adoption.certification_expiry_date}
                      </p>
                    </div>
                    <Button size="sm" variant="outline">
                      Renew
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <button
                onClick={() => navigate("/compliance/gaps")}
                className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <span className="font-medium text-gray-900">
                    View Open Gaps
                  </span>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </button>

              <button
                onClick={() => navigate("/compliance/adoptions")}
                className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <Target className="h-5 w-5 text-blue-600" />
                  <span className="font-medium text-gray-900">
                    Framework Adoptions
                  </span>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </button>

              <button
                onClick={() => navigate("/compliance/reports")}
                className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-gray-900">
                    Generate Report
                  </span>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </button>

              <button
                onClick={() => calculateAllMutation.mutate()}
                disabled={calculateAllMutation.isPending}
                className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <BarChart2 className="h-5 w-5 text-purple-600" />
                  <span className="font-medium text-gray-900">
                    {calculateAllMutation.isPending
                      ? "Calculating..."
                      : "Recalculate Compliance"}
                  </span>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Adopt Framework Dialog */}
      <AdoptFrameworkDialog
        open={showAdoptDialog}
        onClose={() => setShowAdoptDialog(false)}
        onSuccess={() => {
          setShowAdoptDialog(false);
          queryClient.invalidateQueries({ queryKey: ["compliance-overview"] });
          queryClient.invalidateQueries({ queryKey: ["framework-adoptions"] });
        }}
      />
    </div>
  );
}
