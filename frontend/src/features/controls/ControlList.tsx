import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { controlsApi } from "../../api/controls";
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
import { Plus, Search, Filter, Eye, Edit, Trash2 } from "lucide-react";
import { CONTROL_STATUS } from "../../lib/constants";
import { ApplyControlDialog } from "./ApplyControlDialog";
import { cn } from "../../lib/utils";
import type { AppliedControl } from "../../types/control.types";

export function ControlList() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showApplyDialog, setShowApplyDialog] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["applied-controls", page, search, statusFilter],
    queryFn: () =>
      controlsApi.getAppliedControls({
        page,
        page_size: 20,
        search: search || undefined,
        status: statusFilter || undefined,
      }),
  });

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleStatusFilter = (status: string) => {
    setStatusFilter(statusFilter === status ? "" : status);
    setPage(1);
  };

  const handleViewControl = (control: AppliedControl) => {
    navigate(`/controls/${control.id}`);
  };

  const statuses = [
    "not_started",
    "in_progress",
    "implemented",
    "testing",
    "operational",
    "needs_improvement",
    "non_compliant",
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Controls</h1>
          <p className="text-gray-600 mt-1">
            Manage your implemented security controls
          </p>
        </div>
        <Button onClick={() => setShowApplyDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Apply Control
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search controls..."
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Status filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="h-4 w-4 text-gray-400" />
              {statuses.slice(0, 4).map((status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleStatusFilter(status)}
                >
                  {CONTROL_STATUS[status as keyof typeof CONTROL_STATUS]?.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Controls Table */}
      <Card>
        <CardHeader>
          <CardTitle>Applied Controls</CardTitle>
          <CardDescription>{data?.count || 0} controls found</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingSpinner />
          ) : data?.results.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No controls found</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setShowApplyDialog(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Apply Your First Control
              </Button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-gray-700">
                        Control
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">
                        Department
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">
                        Status
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">
                        Score
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">
                        Evidence
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">
                        Owner
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-gray-700">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.results.map((control) => (
                      <tr
                        key={control.id}
                        className="border-b hover:bg-gray-50 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-gray-900">
                              {control.reference_control_code}
                            </p>
                            <p className="text-sm text-gray-500 truncate max-w-xs">
                              {control.reference_control_name}
                            </p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm text-gray-600">
                            {control.department_name || "—"}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            className={
                              CONTROL_STATUS[
                                control.status as keyof typeof CONTROL_STATUS
                              ]?.color
                            }
                          >
                            {
                              CONTROL_STATUS[
                                control.status as keyof typeof CONTROL_STATUS
                              ]?.label
                            }
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-gray-200 rounded-full h-2">
                              <div
                                className={cn(
                                  "h-2 rounded-full",
                                  control.compliance_score >= 85
                                    ? "bg-green-500"
                                    : control.compliance_score >= 70
                                      ? "bg-yellow-500"
                                      : "bg-red-500",
                                )}
                                style={{
                                  width: `${control.compliance_score}%`,
                                }}
                              />
                            </div>
                            <span className="text-sm font-medium text-gray-900">
                              {control.compliance_score}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div
                              className={cn(
                                "h-2 w-2 rounded-full",
                                control.evidence_count > 0
                                  ? "bg-green-500"
                                  : "bg-gray-300",
                              )}
                            />
                            <span className="text-sm text-gray-600">
                              {control.evidence_count}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm text-gray-600">
                            {control.control_owner_email || "—"}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleViewControl(control)}
                            >
                              <Eye className="h-4 w-4" />
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
                    {Math.min(page * 20, data.count)} of {data.count} controls
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

      {/* Apply Control Dialog */}
      <ApplyControlDialog
        open={showApplyDialog}
        onClose={() => setShowApplyDialog(false)}
        onSuccess={() => {
          setShowApplyDialog(false);
          refetch();
        }}
      />
    </div>
  );
}
