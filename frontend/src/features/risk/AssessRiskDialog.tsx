import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { controlsApi } from "../../api/controls";
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
import { Badge } from "../../components/ui/badge";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { Search, Shield } from "lucide-react";
import { getErrorMessage } from "../../api/client";
import { CONTROL_STATUS } from "../../lib/constants";
import type { AppliedControl } from "../../types/control.types";

interface AssessRiskDialogProps {
  riskId: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AssessRiskDialog({
  riskId,
  open,
  onClose,
  onSuccess,
}: AssessRiskDialogProps) {
  const [search, setSearch] = useState("");
  const [selectedControl, setSelectedControl] = useState<AppliedControl | null>(
    null,
  );
  const [effectivenessRating, setEffectivenessRating] = useState(75);
  const [notes, setNotes] = useState("");

  const { data: controls, isLoading } = useQuery({
    queryKey: ["applied-controls", search],
    queryFn: () =>
      controlsApi.getAppliedControls({
        search: search || undefined,
        page_size: 50,
      }),
    enabled: open,
  });

  const assessMutation = useMutation({
    mutationFn: (data: {
      applied_control: string;
      effectiveness_rating: number;
      assessment_notes?: string;
    }) => riskApi.assessRiskWithControl(riskId, data),
    onSuccess: () => {
      onSuccess();
      setSelectedControl(null);
      setSearch("");
      setNotes("");
      setEffectivenessRating(75);
    },
  });

  const handleAssess = () => {
    if (!selectedControl) return;

    assessMutation.mutate({
      applied_control: selectedControl.id,
      effectiveness_rating: effectivenessRating,
      assessment_notes: notes || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Link Control to Risk</DialogTitle>
          <DialogDescription>
            Select a control that mitigates this risk and assess its
            effectiveness
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search controls..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Error */}
          {assessMutation.error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
              {getErrorMessage(assessMutation.error)}
            </div>
          )}

          {/* Selected Control and Effectiveness */}
          {selectedControl ? (
            <div className="space-y-4 border border-primary rounded-lg p-4">
              <div>
                <h3 className="font-medium text-gray-900 mb-2">
                  Selected Control
                </h3>
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {selectedControl.reference_control_code}
                    </p>
                    <p className="text-sm text-gray-600">
                      {selectedControl.reference_control_name}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedControl(null)}
                  >
                    Change
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Control Effectiveness ({effectivenessRating}%)
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={effectivenessRating}
                  onChange={(e) =>
                    setEffectivenessRating(parseInt(e.target.value))
                  }
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Not Effective</span>
                  <span>Highly Effective</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Assessment Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Additional notes about this assessment..."
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto border rounded-lg">
              {isLoading ? (
                <LoadingSpinner />
              ) : controls?.results.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No controls found
                </div>
              ) : (
                <div className="divide-y">
                  {controls?.results.map((control) => (
                    <button
                      key={control.id}
                      onClick={() => setSelectedControl(control)}
                      className="w-full p-4 text-left hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Shield className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-medium text-gray-900">
                                {control.reference_control_code}
                              </p>
                              <p className="text-sm text-gray-600 mt-1">
                                {control.reference_control_name}
                              </p>
                            </div>
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
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleAssess}
            disabled={!selectedControl || assessMutation.isPending}
          >
            {assessMutation.isPending ? "Linking..." : "Link Control"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
