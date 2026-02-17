import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { controlsApi } from "../../api/controls";
import { evidenceApi } from "../../api/evidence";
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

interface LinkControlsDialogProps {
  evidenceId: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function LinkControlsDialog({
  evidenceId,
  open,
  onClose,
  onSuccess,
}: LinkControlsDialogProps) {
  const [search, setSearch] = useState("");
  const [selectedControls, setSelectedControls] = useState<Set<string>>(
    new Set(),
  );
  const [linkType, setLinkType] = useState<
    "implementation" | "testing" | "monitoring" | "documentation" | "audit"
  >("implementation");

  const { data: controls, isLoading } = useQuery({
    queryKey: ["applied-controls", search],
    queryFn: () =>
      controlsApi.getAppliedControls({
        search: search || undefined,
        page_size: 50,
      }),
    enabled: open,
  });

  const linkMutation = useMutation({
    mutationFn: (data: {
      evidence_ids: string[];
      control_ids: string[];
      link_type: string;
    }) => evidenceApi.bulkLinkEvidence(data),
    onSuccess: () => {
      onSuccess();
      setSelectedControls(new Set());
      setSearch("");
    },
  });

  const handleToggleControl = (controlId: string) => {
    const newSelected = new Set(selectedControls);
    if (newSelected.has(controlId)) {
      newSelected.delete(controlId);
    } else {
      newSelected.add(controlId);
    }
    setSelectedControls(newSelected);
  };

  const handleLink = () => {
    if (selectedControls.size === 0) return;

    linkMutation.mutate({
      evidence_ids: [evidenceId],
      control_ids: Array.from(selectedControls),
      link_type: linkType,
    });
  };

  const linkTypes = [
    { value: "implementation", label: "Implementation" },
    { value: "testing", label: "Testing" },
    { value: "monitoring", label: "Monitoring" },
    { value: "documentation", label: "Documentation" },
    { value: "audit", label: "Audit" },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Link Controls</DialogTitle>
          <DialogDescription>
            Select controls that this evidence supports
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Link Type Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Link Type</label>
            <div className="flex gap-2 flex-wrap">
              {linkTypes.map((type) => (
                <Button
                  key={type.value}
                  type="button"
                  variant={linkType === type.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setLinkType(type.value as any)}
                >
                  {type.label}
                </Button>
              ))}
            </div>
          </div>

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
          {linkMutation.error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
              {getErrorMessage(linkMutation.error)}
            </div>
          )}

          {/* Controls List */}
          <div className="flex-1 overflow-y-auto border rounded-lg">
            {isLoading ? (
              <LoadingSpinner />
            ) : controls?.results.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No controls found
              </div>
            ) : (
              <div className="divide-y">
                {controls?.results.map((control) => {
                  const isSelected = selectedControls.has(control.id);

                  return (
                    <button
                      key={control.id}
                      onClick={() => handleToggleControl(control.id)}
                      className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                        isSelected ? "bg-blue-50 border-l-4 border-primary" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-1">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
                          />
                        </div>

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
                            <div className="flex flex-col items-end gap-1">
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
                              {control.department_name && (
                                <span className="text-xs text-gray-500">
                                  {control.department_name}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selected Count */}
          {selectedControls.size > 0 && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800">
                {selectedControls.size} control
                {selectedControls.size !== 1 ? "s" : ""} selected
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleLink}
            disabled={selectedControls.size === 0 || linkMutation.isPending}
          >
            {linkMutation.isPending
              ? "Linking..."
              : `Link ${selectedControls.size} Control${selectedControls.size !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
