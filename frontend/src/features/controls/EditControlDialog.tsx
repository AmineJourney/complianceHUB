/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { controlsApi } from "../../api/controls";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { getErrorMessage } from "../../api/client";
import type { AppliedControl } from "../../types/control.types";

interface EditControlDialogProps {
  control: AppliedControl;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditControlDialog({
  control,
  open,
  onClose,
  onSuccess,
}: EditControlDialogProps) {
  const [formData, setFormData] = useState({
    status: control.status,
    implementation_notes: control.implementation_notes,
    effectiveness_rating: control.effectiveness_rating || 0,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<AppliedControl>) =>
      controlsApi.updateAppliedControl(control.id, data),
    onSuccess: () => {
      onSuccess();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  const statuses = [
    { value: "not_started", label: "Not Started" },
    { value: "in_progress", label: "In Progress" },
    { value: "implemented", label: "Implemented" },
    { value: "testing", label: "Testing" },
    { value: "operational", label: "Operational" },
    { value: "needs_improvement", label: "Needs Improvement" },
    { value: "non_compliant", label: "Non-Compliant" },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Control</DialogTitle>
          <DialogDescription>
            Update control implementation details
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {updateMutation.error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
              {getErrorMessage(updateMutation.error)}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Status</label>
            <select
              value={formData.status}
              onChange={(e) =>
                setFormData({ ...formData, status: e.target.value as any })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {statuses.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Effectiveness Rating (%)
            </label>
            <Input
              type="number"
              min="0"
              max="100"
              value={formData.effectiveness_rating}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  effectiveness_rating: parseInt(e.target.value),
                })
              }
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Implementation Notes</label>
            <textarea
              value={formData.implementation_notes}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  implementation_notes: e.target.value,
                })
              }
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
