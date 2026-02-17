import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { Search, Shield } from "lucide-react";
import { getErrorMessage } from "../../api/client";
import type { ReferenceControl } from "../../types/control.types";

interface ApplyControlDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ApplyControlDialog({
  open,
  onClose,
  onSuccess,
}: ApplyControlDialogProps) {
  const [search, setSearch] = useState("");
  const [selectedControl, setSelectedControl] =
    useState<ReferenceControl | null>(null);

  const { data: referenceControls, isLoading } = useQuery({
    queryKey: ["reference-controls", search],
    queryFn: () =>
      controlsApi.getReferenceControls({
        search: search || undefined,
        page_size: 50,
      }),
    enabled: open,
  });

  const applyMutation = useMutation({
    mutationFn: (controlId: string) =>
      controlsApi.applyControl({ reference_control: controlId }),
    onSuccess: () => {
      onSuccess();
      setSelectedControl(null);
      setSearch("");
    },
  });

  const handleApply = () => {
    if (selectedControl) {
      applyMutation.mutate(selectedControl.id);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Apply Control</DialogTitle>
          <DialogDescription>
            Select a reference control to apply to your organization
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
          {applyMutation.error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
              {getErrorMessage(applyMutation.error)}
            </div>
          )}

          {/* Controls List */}
          <div className="flex-1 overflow-y-auto border rounded-lg">
            {isLoading ? (
              <LoadingSpinner />
            ) : referenceControls?.results.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No controls found
              </div>
            ) : (
              <div className="divide-y">
                {referenceControls?.results.map((control) => (
                  <button
                    key={control.id}
                    onClick={() => setSelectedControl(control)}
                    className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                      selectedControl?.id === control.id
                        ? "bg-blue-50 border-l-4 border-primary"
                        : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Shield className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-gray-900">
                              {control.code}
                            </p>
                            <p className="text-sm text-gray-600 mt-1">
                              {control.name}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700 capitalize">
                              {control.control_type.replace("_", " ")}
                            </span>
                            <span
                              className={`text-xs px-2 py-1 rounded-full ${
                                control.priority === "critical"
                                  ? "bg-red-100 text-red-700"
                                  : control.priority === "high"
                                    ? "bg-orange-100 text-orange-700"
                                    : control.priority === "medium"
                                      ? "bg-yellow-100 text-yellow-700"
                                      : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {control.priority}
                            </span>
                          </div>
                        </div>
                        {control.description && (
                          <p className="text-sm text-gray-500 mt-2 line-clamp-2">
                            {control.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={!selectedControl || applyMutation.isPending}
          >
            {applyMutation.isPending ? "Applying..." : "Apply Control"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
