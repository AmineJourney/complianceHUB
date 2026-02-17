import { useQuery } from "@tanstack/react-query";
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
import { Target, ArrowRight, Shield, FileText, Clock } from "lucide-react";

interface ComplianceRecommendationsProps {
  frameworkId: string;
}

export function ComplianceRecommendations({
  frameworkId,
}: ComplianceRecommendationsProps) {
  const navigate = useNavigate();

  const { data: recommendations, isLoading } = useQuery({
    queryKey: ["compliance-recommendations", frameworkId],
    queryFn: () => complianceApi.getRecommendations(frameworkId),
    enabled: !!frameworkId,
  });

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const priorityConfig: Record<
    string,
    { color: string; bg: string; label: string }
  > = {
    critical: { color: "text-red-700", bg: "bg-red-100", label: "Critical" },
    high: { color: "text-orange-700", bg: "bg-orange-100", label: "High" },
    medium: { color: "text-yellow-700", bg: "bg-yellow-100", label: "Medium" },
    low: { color: "text-blue-700", bg: "bg-blue-100", label: "Low" },
  };

  const typeIcons: Record<string, any> = {
    implement_controls: <Shield className="h-5 w-5 text-primary" />,
    add_evidence: <FileText className="h-5 w-5 text-green-600" />,
    review_control: <Clock className="h-5 w-5 text-yellow-600" />,
  };

  const getActionPath = (rec: any) => {
    if (rec.type === "implement_controls") return "/controls";
    if (rec.type === "add_evidence") return "/evidence";
    if (rec.type === "review_control") return "/controls";
    return "/controls";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Compliance Recommendations
        </CardTitle>
        <CardDescription>
          Prioritized actions to improve your compliance score (
          {recommendations?.length || 0} items)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!recommendations || recommendations.length === 0 ? (
          <div className="text-center py-12">
            <Target className="h-12 w-12 text-green-400 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">
              No recommendations right now!
            </p>
            <p className="text-gray-400 text-sm mt-1">
              Your compliance looks great.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {recommendations.map((rec: any, idx: number) => {
              const priority =
                priorityConfig[rec.priority] || priorityConfig.low;
              return (
                <div
                  key={idx}
                  className="flex items-start gap-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {/* Priority indicator */}
                  <div
                    className={`mt-0.5 flex-shrink-0 w-2 h-full min-h-[40px] rounded-full ${priority.bg}`}
                  />

                  {/* Icon */}
                  <div className="flex-shrink-0 mt-0.5">
                    {typeIcons[rec.type] || (
                      <Target className="h-5 w-5 text-gray-400" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-gray-900">
                            {rec.title}
                          </p>
                          <Badge
                            className={`${priority.bg} ${priority.color} border-0`}
                          >
                            {priority.label}
                          </Badge>
                          {rec.estimated_impact && (
                            <Badge variant="outline" className="capitalize">
                              {rec.estimated_impact} impact
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {rec.description}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Action button */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-shrink-0"
                    onClick={() => navigate(getActionPath(rec))}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
