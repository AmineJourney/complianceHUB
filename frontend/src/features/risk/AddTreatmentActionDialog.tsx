/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { riskApi } from "../../api/risk";
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

interface AddTreatmentActionDialogProps {
  riskId: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddTreatmentActionDialog({
  riskId,
  open,
  onClose,
  onSuccess,
}: AddTreatmentActionDialogProps) {
  const [formData, setFormData] = useState({
    action_title: "",
    action_description: "",
    action_type: "implement_control",
    due_date: "",
    estimated_cost: "",
  });

  const createMutation = useMutation({
    mutationFn: (data: any) =>
      riskApi.createTreatmentAction({ ...data, risk: riskId }),
    onSuccess: () => {
      onSuccess();
      setFormData({
        action_title: "",
        action_description: "",
        action_type: "implement_control",
        due_date: "",
        estimated_cost: "",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data: any = {
      action_title: formData.action_title,
      action_description: formData.action_description,
      action_type: formData.action_type,
      due_date: formData.due_date,
    };

    if (formData.estimated_cost) {
      data.estimated_cost = parseFloat(formData.estimated_cost);
    }

    createMutation.mutate(data);
  };

  const actionTypes = [
    { value: "implement_control", label: "Implement Control" },
    { value: "improve_control", label: "Improve Existing Control" },
    { value: "transfer_risk", label: "Transfer Risk" },
    { value: "policy_change", label: "Policy Change" },
    { value: "training", label: "Training/Awareness" },
    { value: "technology", label: "Technology Implementation" },
    { value: "other", label: "Other" },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Treatment Action</DialogTitle>
          <DialogDescription>
            Create an action to mitigate this risk
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {createMutation.error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
              {getErrorMessage(createMutation.error)}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Action Title *</label>
            <Input
              value={formData.action_title}
              onChange={(e) =>
                setFormData({ ...formData, action_title: e.target.value })
              }
              placeholder="Brief description of the action"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Description *</label>
            <textarea
              value={formData.action_description}
              onChange={(e) =>
                setFormData({ ...formData, action_description: e.target.value })
              }
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Detailed description"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Action Type *</label>
            <select
              value={formData.action_type}
              onChange={(e) =>
                setFormData({ ...formData, action_type: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              required
            >
              {actionTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Due Date *</label>
            <Input
              type="date"
              value={formData.due_date}
              onChange={(e) =>
                setFormData({ ...formData, due_date: e.target.value })
              }
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Estimated Cost (optional)
            </label>
            <Input
              type="number"
              step="0.01"
              value={formData.estimated_cost}
              onChange={(e) =>
                setFormData({ ...formData, estimated_cost: e.target.value })
              }
              placeholder="0.00"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Action"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
