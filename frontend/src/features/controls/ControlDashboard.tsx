/* eslint-disable @typescript-eslint/no-unused-vars */
import { useQuery } from "@tanstack/react-query";
import { controlsApi } from "../../api/controls";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { Shield, TrendingUp, AlertTriangle, FileCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function ControlDashboard() {
  const navigate = useNavigate();

  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ["control-dashboard"],
    queryFn: controlsApi.getControlDashboard,
  });

  const { data: overdueControls } = useQuery({
    queryKey: ["overdue-controls"],
    queryFn: controlsApi.getOverdueReviews,
  });

  const { data: deficientControls } = useQuery({
    queryKey: ["deficient-controls"],
    queryFn: controlsApi.getControlsWithDeficiencies,
  });

  const { data: effectiveness } = useQuery({
    queryKey: ["control-effectiveness"],
    queryFn: controlsApi.getEffectivenessMetrics,
  });

  if (dashboardLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Control Dashboard</h1>
        <p className="text-gray-600 mt-1">
          Monitor and manage your security controls
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Avg. Compliance Score
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {dashboard?.avg_compliance_score?.toFixed(0) || 0}%
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
                <p className="text-sm font-medium text-gray-600">
                  Total Controls
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {dashboard?.total_controls || 0}
                </p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center">
                <Shield className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Evidence Coverage
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {dashboard?.evidence_coverage_percentage?.toFixed(0) || 0}%
                </p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center">
                <FileCheck className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  With Deficiencies
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {dashboard?.controls_with_deficiencies || 0}
                </p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Items */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Overdue Reviews */}
        <Card>
          <CardHeader>
            <CardTitle>Overdue Reviews</CardTitle>
            <CardDescription>
              Controls requiring immediate attention (
              {overdueControls?.length || 0})
            </CardDescription>
          </CardHeader>
          <CardContent>
            {overdueControls && overdueControls.length > 0 ? (
              <div className="space-y-3">
                {overdueControls.slice(0, 5).map((control) => (
                  <div
                    key={control.id}
                    className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {control.reference_control_code}
                      </p>
                      <p className="text-sm text-gray-600 truncate">
                        Due: {control.next_review_date}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/controls/${control.id}`)}
                    >
                      Review
                    </Button>
                  </div>
                ))}
                {overdueControls.length > 5 && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate("/controls")}
                  >
                    View All {overdueControls.length} Overdue Controls
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">
                No overdue reviews
              </p>
            )}
          </CardContent>
        </Card>

        {/* Controls with Deficiencies */}
        <Card>
          <CardHeader>
            <CardTitle>Deficiencies</CardTitle>
            <CardDescription>
              Controls needing remediation ({deficientControls?.length || 0})
            </CardDescription>
          </CardHeader>
          <CardContent>
            {deficientControls && deficientControls.length > 0 ? (
              <div className="space-y-3">
                {deficientControls.slice(0, 5).map((control) => (
                  <div
                    key={control.id}
                    className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {control.reference_control_code}
                      </p>
                      <p className="text-sm text-gray-600 truncate">
                        Score: {control.compliance_score}%
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/controls/${control.id}`)}
                    >
                      Fix
                    </Button>
                  </div>
                ))}
                {deficientControls.length > 5 && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate("/controls")}
                  >
                    View All {deficientControls.length} Controls
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">
                No deficiencies found
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
