import { useState, useMemo } from "react";
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
import { Badge } from "../../components/ui/badge";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { Search, Shield, AlertCircle } from "lucide-react";
import { getErrorMessage } from "../../api/client";
import type { ReferenceControl } from "../../types/control.types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApplyControlDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// ─── Style maps ───────────────────────────────────────────────────────────────

const PRIORITY_STYLES: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-gray-100 text-gray-600",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ApplyControlDialog({
  open,
  onClose,
  onSuccess,
}: ApplyControlDialogProps) {
  const [search, setSearch] = useState("");
  const [activeFramework, setActiveFramework] = useState<string>("all");
  const [selectedControl, setSelectedControl] =
    useState<ReferenceControl | null>(null);

  // Single query — the backend adopted_only=true filter scopes results to
  // the frameworks this company has adopted (any status except "suspended").
  // Framework tabs are derived from the frameworks field on each control,
  // so we never need to call the adoptions endpoint separately.
  const { data: controlsData, isLoading } = useQuery({
    queryKey: ["reference-controls-adopted", search],
    queryFn: () =>
      controlsApi.getReferenceControls({
        search: search || undefined,
        page_size: 500,
        adopted_only: true,
      }),
    enabled: open,
  });

  const applyMutation = useMutation({
    mutationFn: (controlId: string) =>
      controlsApi.applyControl({ reference_control: controlId }),
    onSuccess: () => {
      onSuccess();
      reset();
    },
  });

  // Derive unique framework codes from the returned controls.
  // This is guaranteed to reflect exactly what the backend filtered to.
  const frameworkTabs = useMemo(() => {
    const codes = new Set<string>();
    (controlsData?.results ?? []).forEach((c) => {
      (c.frameworks ?? []).forEach((fw) => codes.add(fw));
    });
    return Array.from(codes).sort();
  }, [controlsData]);

  // Filter the visible list by whichever tab is active
  const visibleControls = useMemo(() => {
    const all = controlsData?.results ?? [];
    if (activeFramework === "all") return all;
    return all.filter((c) => (c.frameworks ?? []).includes(activeFramework));
  }, [controlsData, activeFramework]);

  const handleApply = () => {
    if (selectedControl) applyMutation.mutate(selectedControl.id);
  };

  const reset = () => {
    setSearch("");
    setActiveFramework("all");
    setSelectedControl(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const noControls = !isLoading && (controlsData?.results ?? []).length === 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Apply Control</DialogTitle>
          <DialogDescription>
            Showing controls for your adopted compliance frameworks
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
          {/* ── No controls / no adoptions notice ───────────────────────── */}
          {noControls && (
            <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-600" />
              <div>
                <p className="font-medium">No controls available</p>
                <p className="mt-0.5 text-amber-700">
                  Go to{" "}
                  <span className="font-medium">Compliance → Frameworks</span>{" "}
                  and adopt a framework first.
                </p>
              </div>
            </div>
          )}

          {/* ── Framework tabs ───────────────────────────────────────────── */}
          {frameworkTabs.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {/* All tab */}
              <button
                onClick={() => {
                  setActiveFramework("all");
                  setSelectedControl(null);
                }}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  activeFramework === "all"
                    ? "bg-primary text-white border-primary"
                    : "bg-white text-gray-600 border-gray-200 hover:border-primary hover:text-primary"
                }`}
              >
                All ({controlsData?.results?.length ?? 0})
              </button>

              {/* One tab per adopted framework */}
              {frameworkTabs.map((code) => {
                const count = (controlsData?.results ?? []).filter((c) =>
                  (c.frameworks ?? []).includes(code),
                ).length;
                return (
                  <button
                    key={code}
                    onClick={() => {
                      setActiveFramework(code);
                      setSelectedControl(null);
                    }}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      activeFramework === code
                        ? "bg-primary text-white border-primary"
                        : "bg-white text-gray-600 border-gray-200 hover:border-primary hover:text-primary"
                    }`}
                  >
                    {code} ({count})
                  </button>
                );
              })}
            </div>
          )}

          {/* ── Search ───────────────────────────────────────────────────── */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by name, code or family…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelectedControl(null);
              }}
              className="pl-10"
            />
          </div>

          {/* ── Mutation error ───────────────────────────────────────────── */}
          {applyMutation.error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
              {getErrorMessage(applyMutation.error)}
            </div>
          )}

          {/* ── Controls list ─────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto border rounded-lg">
            {isLoading ? (
              <LoadingSpinner />
            ) : visibleControls.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Shield className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="font-medium">No controls found</p>
                {search && (
                  <p className="text-sm mt-1">Try a different search term.</p>
                )}
              </div>
            ) : (
              <div className="divide-y">
                {visibleControls.map((control) => {
                  const isSelected = selectedControl?.id === control.id;
                  const frameworks: string[] = control.frameworks ?? [];

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
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Shield className="h-4 w-4 text-primary" />
                        </div>

                        {/* Body */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              {/* Code + name */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                  {control.code}
                                </span>
                                <p className="font-medium text-sm text-gray-900">
                                  {control.name}
                                </p>
                              </div>

                              {/* Description */}
                              {control.description && (
                                <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                  {control.description}
                                </p>
                              )}

                              {/* Framework pills — only on "All" tab */}
                              {activeFramework === "all" &&
                                frameworks.length > 0 && (
                                  <div className="flex gap-1 mt-1.5 flex-wrap">
                                    {frameworks.map((fw) => (
                                      <span
                                        key={fw}
                                        className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100"
                                      >
                                        {fw}
                                      </span>
                                    ))}
                                  </div>
                                )}
                            </div>

                            {/* Priority badge */}
                            <Badge
                              className={`text-xs flex-shrink-0 ${
                                PRIORITY_STYLES[control.priority] ?? ""
                              }`}
                            >
                              {control.priority}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Selection summary ────────────────────────────────────────── */}
          {selectedControl && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800">
              Selected:{" "}
              <span className="font-medium">{selectedControl.name}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
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
