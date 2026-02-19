/* eslint-disable @typescript-eslint/no-unused-vars */
// src/features/library/FrameworkDetail.tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { libraryApi } from "@/api/library";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  CheckCircle,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import type { FrameworkRequirementTree } from "@/types/library.types";

export function FrameworkDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: framework, isLoading: frameworkLoading } = useQuery({
    queryKey: ["framework", id],
    queryFn: () => libraryApi.getFramework(id!),
    enabled: !!id,
  });

  const { data: requirementsTree, isLoading: treeLoading } = useQuery({
    queryKey: ["framework-requirements-tree", id],
    queryFn: () => libraryApi.getFrameworkRequirementsTree(id!),
    enabled: !!id,
  });

  const { data: statistics, isLoading: statsLoading } = useQuery({
    queryKey: ["framework-statistics", id],
    queryFn: () => libraryApi.getFrameworkStatistics(id!),
    enabled: !!id,
  });

  if (frameworkLoading || treeLoading || statsLoading) {
    return <LoadingSpinner />;
  }

  if (!framework) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Framework not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/library/frameworks")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Frameworks
          </Button>
        </div>

        {framework.documentation_url && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(framework.documentation_url, "_blank")}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Official Documentation
          </Button>
        )}
      </div>

      {/* Framework Info */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl">{framework.code}</CardTitle>
              <CardDescription className="text-lg mt-2">
                {framework.name}
              </CardDescription>
            </div>
            {framework.is_active && (
              <Badge className="bg-green-100 text-green-800">Active</Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {framework.description && (
            <p className="text-gray-700">{framework.description}</p>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
            <div>
              <p className="text-sm text-gray-600">Version</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">
                {framework.version}
              </p>
            </div>

            {framework.issuing_organization && (
              <div>
                <p className="text-sm text-gray-600">Issued by</p>
                <p className="text-lg font-semibold text-gray-900 mt-1">
                  {framework.issuing_organization}
                </p>
              </div>
            )}

            {framework.effective_date && (
              <div>
                <p className="text-sm text-gray-600">Effective Date</p>
                <p className="text-lg font-semibold text-gray-900 mt-1">
                  {new Date(framework.effective_date).toLocaleDateString()}
                </p>
              </div>
            )}

            <div>
              <p className="text-sm text-gray-600">Total Requirements</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">
                {framework.requirement_count}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      {statistics && (
        <Card>
          <CardHeader>
            <CardTitle>Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-gray-600">Total Requirements</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {statistics.total_requirements}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600">Mandatory</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">
                  {statistics.mandatory_requirements}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600">Optional</p>
                <p className="text-2xl font-bold text-gray-600 mt-1">
                  {statistics.optional_requirements}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600">By Priority</p>
                <div className="flex items-center space-x-2 mt-1">
                  {Object.entries(statistics.by_priority).map(
                    ([priority, count]) => (
                      <Badge
                        key={priority}
                        variant="outline"
                        className={
                          priority === "critical"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : priority === "high"
                              ? "bg-orange-50 text-orange-700 border-orange-200"
                              : priority === "medium"
                                ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                                : "bg-gray-50 text-gray-700 border-gray-200"
                        }
                      >
                        {count}
                      </Badge>
                    ),
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Requirements Tree */}
      <Card>
        <CardHeader>
          <CardTitle>Requirements</CardTitle>
          <CardDescription>
            Hierarchical view of all framework requirements
          </CardDescription>
        </CardHeader>
        <CardContent>
          {requirementsTree && requirementsTree.length > 0 ? (
            <div className="space-y-2">
              {requirementsTree.map((requirement) => (
                <RequirementTreeNode
                  key={requirement.id}
                  requirement={requirement}
                />
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">
              No requirements found for this framework
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Recursive tree node component
function RequirementTreeNode({
  requirement,
}: {
  requirement: FrameworkRequirementTree;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasChildren = requirement.children && requirement.children.length > 0;

  return (
    <div className="space-y-1">
      <div
        className={`flex items-start space-x-2 p-3 rounded-lg hover:bg-gray-50 cursor-pointer ${
          hasChildren ? "" : "ml-6"
        }`}
        onClick={() => hasChildren && setIsExpanded(!isExpanded)}
      >
        {hasChildren && (
          <button className="mt-0.5 flex-shrink-0">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-500" />
            )}
          </button>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <span className="font-mono text-sm font-medium text-gray-900">
                  {requirement.requirement_id}
                </span>
                {requirement.section && (
                  <Badge variant="outline" className="text-xs">
                    {requirement.section}
                  </Badge>
                )}
                {requirement.is_mandatory && (
                  <Badge
                    variant="outline"
                    className="bg-blue-50 text-blue-700 border-blue-200 text-xs"
                  >
                    Mandatory
                  </Badge>
                )}
              </div>
              <p className="text-sm text-gray-700 mt-1">{requirement.title}</p>
            </div>

            <div className="flex items-center space-x-2 ml-4">
              {requirement.mapped_controls_count > 0 && (
                <Badge
                  variant="outline"
                  className="bg-green-50 text-green-700 border-green-200"
                >
                  {requirement.mapped_controls_count} controls
                </Badge>
              )}
              <Badge
                variant="outline"
                className={
                  requirement.priority === "critical"
                    ? "bg-red-50 text-red-700 border-red-200"
                    : requirement.priority === "high"
                      ? "bg-orange-50 text-orange-700 border-orange-200"
                      : requirement.priority === "medium"
                        ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                        : "bg-gray-50 text-gray-700 border-gray-200"
                }
              >
                {requirement.priority}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div className="ml-8 space-y-1 border-l-2 border-gray-200 pl-4">
          {requirement.children.map((child) => (
            <RequirementTreeNode key={child.id} requirement={child} />
          ))}
        </div>
      )}
    </div>
  );
}
