/* eslint-disable @typescript-eslint/no-explicit-any */
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

const PRIORITY_STYLES: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-gray-100 text-gray-600",
};

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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by name, code or family…"
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
            ) : !referenceControls?.results.length ? (
              <div className="text-center py-12 text-gray-500">
                No controls found
              </div>
            ) : (
              <div className="divide-y">
                {referenceControls.results.map((control) => {
                  const isSelected = selectedControl?.id === control.id;
                  const frameworks: string[] =
                    (control as any).frameworks ?? [];

                  return (
                    <button
                      key={control.id}
                      onClick={() => setSelectedControl(control)}
                      className={`w-full p-4 text-left transition-colors ${
                        isSelected
                          ? "bg-blue-50 border-l-4 border-primary"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Shield className="h-4 w-4 text-primary" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          {/* Name — primary heading */}
                          <p className="font-semibold text-gray-900 leading-tight">
                            {control.name}
                          </p>

                          {/* Code + family — secondary line */}
                          <p className="text-xs text-gray-500 mt-0.5">
                            <span className="font-mono">{control.code}</span>
                            {control.control_family && (
                              <>
                                {" · "}
                                {control.control_family.replace(/_/g, " ")}
                              </>
                            )}
                          </p>

                          {/* Framework badges + priority badge */}
                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            {frameworks.length > 0 ? (
                              frameworks.map((fw) => (
                                <span
                                  key={fw}
                                  className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium"
                                >
                                  {fw}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-gray-400 italic">
                                No framework mapping
                              </span>
                            )}

                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ml-auto capitalize ${
                                PRIORITY_STYLES[control.priority] ??
                                "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {control.priority}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selection summary */}
          {selectedControl && (
            <div className="text-sm text-gray-600 bg-gray-50 rounded-md px-3 py-2">
              Selected:{" "}
              <span className="font-semibold text-gray-900">
                {selectedControl.name}
              </span>{" "}
              <span className="font-mono text-xs text-gray-500">
                ({selectedControl.code})
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={!selectedControl || applyMutation.isPending}
          >
            {applyMutation.isPending ? "Applying…" : "Apply Control"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
