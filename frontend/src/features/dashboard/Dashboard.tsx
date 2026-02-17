import { useQuery } from "@tanstack/react-query";
import { controlsApi } from "../../api/controls";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import {
  Shield,
  AlertTriangle,
  FileText,
  CheckCircle,
  TrendingUp,
  Clock,
} from "lucide-react";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { Badge } from "../../components/ui/badge";
import { CONTROL_STATUS } from "../../lib/constants";

export function Dashboard() {
  const { data: controlDashboard, isLoading } = useQuery({
    queryKey: ["control-dashboard"],
    queryFn: controlsApi.getControlDashboard,
  });

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const stats = [
    {
      name: "Total Controls",
      value: controlDashboard?.total_controls || 0,
      icon: Shield,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      name: "Operational",
      value:
        controlDashboard?.status_breakdown?.find(
          (s: any) => s.status === "operational",
        )?.count || 0,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      name: "With Deficiencies",
      value: controlDashboard?.controls_with_deficiencies || 0,
      icon: AlertTriangle,
      color: "text-orange-600",
      bgColor: "bg-orange-100",
    },
    {
      name: "Overdue Reviews",
      value: controlDashboard?.overdue_reviews || 0,
      icon: Clock,
      color: "text-red-600",
      bgColor: "bg-red-100",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">
          Overview of your compliance posture
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.name}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      {stat.name}
                    </p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      {stat.value}
                    </p>
                  </div>
                  <div
                    className={`h-12 w-12 rounded-lg ${stat.bgColor} flex items-center justify-center`}
                  >
                    <Icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compliance Score */}
        <Card>
          <CardHeader>
            <CardTitle>Average Compliance Score</CardTitle>
            <CardDescription>Overall control effectiveness</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-48">
              <div className="text-center">
                <div className="text-5xl font-bold text-primary">
                  {controlDashboard?.avg_compliance_score?.toFixed(0) || 0}%
                </div>
                <p className="text-sm text-gray-600 mt-2">Compliance Score</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Control Status</CardTitle>
            <CardDescription>
              Distribution by implementation status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {controlDashboard?.status_breakdown?.map((item: any) => (
                <div
                  key={item.status}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center space-x-2">
                    <Badge
                      className={
                        CONTROL_STATUS[
                          item.status as keyof typeof CONTROL_STATUS
                        ]?.color
                      }
                    >
                      {
                        CONTROL_STATUS[
                          item.status as keyof typeof CONTROL_STATUS
                        ]?.label
                      }
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full"
                        style={{
                          width: `${(item.count / (controlDashboard?.total_controls || 1)) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-900 w-8 text-right">
                      {item.count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Evidence Coverage */}
      <Card>
        <CardHeader>
          <CardTitle>Evidence Coverage</CardTitle>
          <CardDescription>Controls with supporting evidence</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-gray-600">Coverage</span>
                <span className="font-medium">
                  {controlDashboard?.evidence_coverage_percentage?.toFixed(1) ||
                    0}
                  %
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-green-500 h-3 rounded-full transition-all"
                  style={{
                    width: `${controlDashboard?.evidence_coverage_percentage || 0}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
