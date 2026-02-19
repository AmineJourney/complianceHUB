// src/features/organizations/DepartmentTree.tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { organizationsApi } from "@/api/organizations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown,
  ChevronRight,
  Building2,
  Users,
  Plus,
} from "lucide-react";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import type { DepartmentTree as DepartmentTreeType } from "../../types/organizations.types";

export function DepartmentTree() {
  const { data: tree, isLoading } = useQuery({
    queryKey: ["department-tree"],
    queryFn: organizationsApi.getDepartmentTree,
  });

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Organization Structure
        </h1>
        <p className="text-gray-600 mt-1">
          Hierarchical view of your organization's departments
        </p>
      </div>

      {/* Tree View */}
      <Card>
        <CardHeader>
          <CardTitle>Department Hierarchy</CardTitle>
        </CardHeader>
        <CardContent>
          {tree && tree.length > 0 ? (
            <div className="space-y-2">
              {tree.map((dept) => (
                <TreeNode key={dept.id} department={dept} level={0} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">No departments yet</p>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create First Department
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Recursive tree node component
interface TreeNodeProps {
  department: DepartmentTreeType;
  level: number;
}

function TreeNode({ department, level }: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(level < 2); // Auto-expand first 2 levels
  const hasChildren = department.children && department.children.length > 0;

  // Colors for different levels
  const levelColors = [
    "bg-blue-50 border-blue-200",
    "bg-green-50 border-green-200",
    "bg-purple-50 border-purple-200",
    "bg-orange-50 border-orange-200",
    "bg-pink-50 border-pink-200",
  ];
  const colorClass = levelColors[level % levelColors.length];

  return (
    <div className="space-y-2">
      <div
        className={`flex items-center space-x-3 p-4 rounded-lg border-2 ${colorClass} transition-all ${
          hasChildren ? "cursor-pointer hover:shadow-md" : ""
        }`}
        style={{ marginLeft: `${level * 40}px` }}
        onClick={() => hasChildren && setIsExpanded(!isExpanded)}
      >
        {/* Expand/Collapse Button */}
        {hasChildren && (
          <button className="flex-shrink-0">
            {isExpanded ? (
              <ChevronDown className="h-5 w-5 text-gray-600" />
            ) : (
              <ChevronRight className="h-5 w-5 text-gray-600" />
            )}
          </button>
        )}

        {/* Department Icon */}
        <div className="flex-shrink-0">
          <div className="h-10 w-10 rounded-lg bg-white flex items-center justify-center">
            <Building2 className="h-5 w-5 text-gray-700" />
          </div>
        </div>

        {/* Department Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <h3 className="font-semibold text-gray-900">{department.name}</h3>
            {!department.is_active && (
              <Badge variant="outline" className="bg-gray-100 text-gray-600">
                Inactive
              </Badge>
            )}
            {hasChildren && (
              <Badge variant="outline" className="bg-white">
                {department.children.length} sub-departments
              </Badge>
            )}
          </div>

          {department.description && (
            <p className="text-sm text-gray-600 mt-1">
              {department.description}
            </p>
          )}

          <div className="flex items-center space-x-4 mt-2">
            {department.manager_email && (
              <div className="flex items-center text-sm text-gray-600">
                <Users className="h-3 w-3 mr-1" />
                {department.manager_email}
              </div>
            )}
            {department.member_count > 0 && (
              <Badge variant="outline" className="bg-white text-xs">
                {department.member_count} members
              </Badge>
            )}
          </div>
        </div>

        {/* Level Indicator */}
        <div className="flex-shrink-0">
          <Badge variant="outline" className="bg-white">
            Level {level + 1}
          </Badge>
        </div>
      </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div className="space-y-2">
          {department.children.map((child) => (
            <TreeNode key={child.id} department={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
