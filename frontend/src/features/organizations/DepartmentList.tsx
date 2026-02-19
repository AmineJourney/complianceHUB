// src/features/organizations/DepartmentList.tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { organizationsApi } from "@/api/organizations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Users,
  Building2,
  ChevronRight,
} from "lucide-react";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import {
  CreateDepartmentDialog,
  EditDepartmentDialog,
} from "./DepartmentDialogs";

import type { Department } from "@/types/organizations.types";

export function DepartmentList() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(
    null,
  );

  const { data: departmentsData, isLoading } = useQuery({
    queryKey: ["departments"],
    queryFn: () => organizationsApi.getDepartments(),
  });

  const deleteMutation = useMutation({
    mutationFn: organizationsApi.deleteDepartment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      queryClient.invalidateQueries({ queryKey: ["department-tree"] });
    },
  });

  const departments = departmentsData?.results || [];

  const filteredDepartments = departments.filter(
    (dept) =>
      dept.name.toLowerCase().includes(search.toLowerCase()) ||
      dept.description?.toLowerCase().includes(search.toLowerCase()) ||
      dept.full_path.toLowerCase().includes(search.toLowerCase()),
  );

  const handleDelete = (dept: Department) => {
    if (window.confirm(`Are you sure you want to delete "${dept.name}"?`)) {
      deleteMutation.mutate(dept.id);
    }
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Departments</h1>
          <p className="text-gray-600 mt-1">
            Manage your organization's department structure
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Department
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search departments..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Departments</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {departments.length}
                </p>
              </div>
              <Building2 className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active</p>
                <p className="text-2xl font-bold text-green-600 mt-1">
                  {departments.filter((d) => d.is_active).length}
                </p>
              </div>
              <Building2 className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Top-Level</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">
                  {departments.filter((d) => !d.parent).length}
                </p>
              </div>
              <Building2 className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Department List */}
      <Card>
        <CardHeader>
          <CardTitle>All Departments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filteredDepartments.map((dept) => (
              <div
                key={dept.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-medium text-gray-900">{dept.name}</h3>
                    {!dept.is_active && (
                      <Badge
                        variant="outline"
                        className="bg-gray-100 text-gray-600"
                      >
                        Inactive
                      </Badge>
                    )}
                    {dept.children_count > 0 && (
                      <Badge
                        variant="outline"
                        className="bg-blue-50 text-blue-700 border-blue-200"
                      >
                        {dept.children_count} sub-departments
                      </Badge>
                    )}
                  </div>

                  {dept.description && (
                    <p className="text-sm text-gray-600 mt-1">
                      {dept.description}
                    </p>
                  )}

                  <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                    {dept.parent_name && (
                      <div className="flex items-center">
                        <ChevronRight className="h-3 w-3 mr-1" />
                        Parent: {dept.parent_name}
                      </div>
                    )}
                    {dept.manager_email && (
                      <div className="flex items-center">
                        <Users className="h-3 w-3 mr-1" />
                        Manager: {dept.manager_email}
                      </div>
                    )}
                    {dept.member_count > 0 && (
                      <div className="flex items-center">
                        <Users className="h-3 w-3 mr-1" />
                        {dept.member_count} members
                      </div>
                    )}
                  </div>

                  {dept.full_path !== dept.name && (
                    <p className="text-xs text-gray-400 mt-1 font-mono">
                      {dept.full_path}
                    </p>
                  )}
                </div>

                <div className="flex items-center space-x-2 ml-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingDepartment(dept)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(dept)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </div>
            ))}

            {filteredDepartments.length === 0 && (
              <div className="text-center py-12">
                <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">
                  {search
                    ? "No departments found matching your search."
                    : "No departments yet."}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      {showCreateDialog && (
        <CreateDepartmentDialog
          open={showCreateDialog}
          onClose={() => setShowCreateDialog(false)}
        />
      )}

      {editingDepartment && (
        <EditDepartmentDialog
          department={editingDepartment}
          open={!!editingDepartment}
          onClose={() => setEditingDepartment(null)}
        />
      )}
    </div>
  );
}
