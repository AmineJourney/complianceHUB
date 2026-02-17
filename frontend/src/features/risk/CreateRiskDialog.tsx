/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
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

interface CreateRiskDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateRiskDialog({
  open,
  onClose,
  onSuccess,
}: CreateRiskDialogProps) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    risk_category: "operational",
    risk_source: "internal" as "internal" | "external" | "both",
    inherent_likelihood: 3,
    inherent_impact: 3,
    treatment_strategy: "mitigate" as
      | "mitigate"
      | "transfer"
      | "accept"
      | "avoid",
    potential_causes: "",
    potential_consequences: "",
  });

  const { data: matrix } = useQuery({
    queryKey: ["active-risk-matrix"],
    queryFn: riskApi.getActiveMatrix,
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: riskApi.createRisk,
    onSuccess: () => {
      onSuccess();
      setFormData({
        title: "",
        description: "",
        risk_category: "operational",
        risk_source: "internal",
        inherent_likelihood: 3,
        inherent_impact: 3,
        treatment_strategy: "mitigate",
        potential_causes: "",
        potential_consequences: "",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const categories = [
    { value: "strategic", label: "Strategic" },
    { value: "operational", label: "Operational" },
    { value: "financial", label: "Financial" },
    { value: "compliance", label: "Compliance" },
    { value: "reputational", label: "Reputational" },
    { value: "technology", label: "Technology" },
    { value: "security", label: "Security" },
    { value: "environmental", label: "Environmental" },
    { value: "legal", label: "Legal" },
  ];

  const maxLikelihood = matrix?.likelihood_levels || 5;
  const maxImpact = matrix?.impact_levels || 5;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Risk</DialogTitle>
          <DialogDescription>
            Identify and assess a new organizational risk
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {createMutation.error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
              {getErrorMessage(createMutation.error)}
            </div>
          )}

          {/* Title */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Risk Title *</label>
            <Input
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="Brief description of the risk"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Description *</label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Detailed description of the risk"
              required
            />
          </div>

          {/* Category and Source */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Category *</label>
              <select
                value={formData.risk_category}
                onChange={(e) =>
                  setFormData({ ...formData, risk_category: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                required
              >
                {categories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Source *</label>
              <select
                value={formData.risk_source}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    risk_source: e.target.value as any,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                required
              >
                <option value="internal">Internal</option>
                <option value="external">External</option>
                <option value="both">Both</option>
              </select>
            </div>
          </div>

          {/* Inherent Risk Assessment */}
          <div className="border border-gray-200 rounded-lg p-4 space-y-4">
            <h3 className="font-medium text-gray-900">
              Inherent Risk Assessment
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Likelihood (1-{maxLikelihood}) *
                </label>
                <Input
                  type="number"
                  min="1"
                  max={maxLikelihood}
                  value={formData.inherent_likelihood}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      inherent_likelihood: parseInt(e.target.value),
                    })
                  }
                  required
                />
                <p className="text-xs text-gray-500">
                  How likely is this risk to occur?
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Impact (1-{maxImpact}) *
                </label>
                <Input
                  type="number"
                  min="1"
                  max={maxImpact}
                  value={formData.inherent_impact}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      inherent_impact: parseInt(e.target.value),
                    })
                  }
                  required
                />
                <p className="text-xs text-gray-500">
                  What would be the impact if it occurs?
                </p>
              </div>
            </div>

            <div className="bg-gray-50 p-3 rounded-md">
              <p className="text-sm text-gray-700">
                <span className="font-medium">Calculated Risk Score:</span>{" "}
                {formData.inherent_likelihood * formData.inherent_impact}
              </p>
            </div>
          </div>

          {/* Treatment Strategy */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Treatment Strategy *</label>
            <select
              value={formData.treatment_strategy}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  treatment_strategy: e.target.value as any,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              required
            >
              <option value="mitigate">Mitigate/Reduce</option>
              <option value="transfer">Transfer</option>
              <option value="accept">Accept</option>
              <option value="avoid">Avoid/Eliminate</option>
            </select>
          </div>

          {/* Potential Causes */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Potential Causes</label>
            <textarea
              value={formData.potential_causes}
              onChange={(e) =>
                setFormData({ ...formData, potential_causes: e.target.value })
              }
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="What could cause this risk to materialize?"
            />
          </div>

          {/* Potential Consequences */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Potential Consequences
            </label>
            <textarea
              value={formData.potential_consequences}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  potential_consequences: e.target.value,
                })
              }
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="What would happen if this risk occurs?"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Risk"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
