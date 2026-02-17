import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import {
  ArrowLeft,
  Edit,
  Trash2,
  FileText,
  Calendar,
  User,
  AlertCircle,
} from "lucide-react";
import { CONTROL_STATUS } from "../../lib/constants";
import { formatDate } from "../../lib/utils";
import { useState } from "react";
import { EditControlDialog } from "./EditControlDialog";

export function ControlDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showEditDialog, setShowEditDialog] = useState(false);

  const { data: control, isLoading } = useQuery({
    queryKey: ["applied-control", id],
    queryFn: () => controlsApi.getAppliedControl(id!),
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => controlsApi.deleteAppliedControl(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applied-controls"] });
      navigate("/controls");
    },
  });

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!control) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Control not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/controls")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {control.reference_control_code}
            </h1>
            <p className="text-gray-600 mt-1">
              {control.reference_control_name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowEditDialog(true)}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm("Are you sure you want to delete this control?")) {
                deleteMutation.mutate();
              }
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Status</p>
                <Badge
                  className={`mt-2 ${
                    CONTROL_STATUS[
                      control.status as keyof typeof CONTROL_STATUS
                    ]?.color
                  }`}
                >
                  {
                    CONTROL_STATUS[
                      control.status as keyof typeof CONTROL_STATUS
                    ]?.label
                  }
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div>
              <p className="text-sm font-medium text-gray-600">
                Compliance Score
              </p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {control.compliance_score}%
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div>
              <p className="text-sm font-medium text-gray-600">
                Evidence Count
              </p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {control.evidence_count}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div>
              <p className="text-sm font-medium text-gray-600">Effectiveness</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {control.effectiveness_rating || "—"}%
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">
                Department
              </label>
              <p className="text-gray-900 mt-1">
                {control.department_name || "Not assigned"}
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">
                Control Owner
              </label>
              <div className="flex items-center gap-2 mt-1">
                <User className="h-4 w-4 text-gray-400" />
                <p className="text-gray-900">
                  {control.control_owner_email || "Not assigned"}
                </p>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">
                Last Tested
              </label>
              <div className="flex items-center gap-2 mt-1">
                <Calendar className="h-4 w-4 text-gray-400" />
                <p className="text-gray-900">
                  {control.last_tested_date
                    ? formatDate(control.last_tested_date)
                    : "Never"}
                </p>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">
                Next Review
              </label>
              <div className="flex items-center gap-2 mt-1">
                <Calendar className="h-4 w-4 text-gray-400" />
                <p className="text-gray-900">
                  {control.next_review_date
                    ? formatDate(control.next_review_date)
                    : "Not scheduled"}
                </p>
                {control.is_overdue && (
                  <Badge variant="destructive">Overdue</Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Implementation Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Implementation Notes</CardTitle>
          </CardHeader>
          <CardContent>
            {control.implementation_notes ? (
              <p className="text-gray-700 whitespace-pre-wrap">
                {control.implementation_notes}
              </p>
            ) : (
              <p className="text-gray-500 italic">No implementation notes</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Deficiencies Alert */}
      {control.has_deficiencies && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-red-900">
                  Control Has Deficiencies
                </h3>
                <p className="text-sm text-red-700 mt-1">
                  This control has identified deficiencies that require
                  remediation.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Related Evidence */}
      <Card>
        <CardHeader>
          <CardTitle>Related Evidence</CardTitle>
          <CardDescription>
            Evidence supporting this control ({control.evidence_count})
          </CardDescription>
        </CardHeader>
        <CardContent>
          {control.evidence_count === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">
                No evidence linked to this control
              </p>
              <Button variant="outline" className="mt-4">
                <FileText className="mr-2 h-4 w-4" />
                Add Evidence
              </Button>
            </div>
          ) : (
            <p className="text-gray-500">Evidence list coming soon...</p>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {control && (
        <EditControlDialog
          control={control}
          open={showEditDialog}
          onClose={() => setShowEditDialog(false)}
          onSuccess={() => {
            setShowEditDialog(false);
            queryClient.invalidateQueries({
              queryKey: ["applied-control", id],
            });
          }}
        />
      )}
    </div>
  );
}
