/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useMemo, useEffect } from "react";
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
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
import { Search, Shield, AlertCircle } from "lucide-react";
import { getErrorMessage } from "../../api/client";
import type { ReferenceControl } from "../../types/control.types";
import { VirtualInfiniteList } from "../../components/common/VirtualInfiniteList";

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
  const [activeFramework, setActiveFramework] = useState<string>("all");
  const [selectedControl, setSelectedControl] =
    useState<ReferenceControl | null>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: ["reference-controls-adopted", search],
      queryFn: ({ pageParam = 1 }: { pageParam?: number }) =>
        controlsApi.getReferenceControls({
          page: pageParam,
          page_size: 1000,
          search: search || undefined,
          adopted_only: true,
        }),
      getNextPageParam: (lastPage: any) => {
        if (!lastPage.next) return undefined;
        const url = new URL(lastPage.next);
        return parseInt(url.searchParams.get('page') || '1');
      },
      enabled: open,
      initialPageParam: 1,
    });

  const applyMutation = useMutation({
    mutationFn: (controlId: string) =>
      controlsApi.applyControl({ reference_control: controlId }),
    onSuccess: () => {
      onSuccess();
      reset();
    },
  });

  const allControls = useMemo(
    () => data?.pages.flatMap((p: any) => p.results) ?? [],
    [data],
  );

  const frameworkTabs = useMemo(() => {
    const counts = new Map<string, number>();
    allControls.forEach((c) => {
      (c.frameworks ?? []).forEach((fw: any) => {
        counts.set(fw, (counts.get(fw) || 0) + 1);
      });
    });
    return Array.from(counts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([code, count]) => ({ code, count }));
  }, [allControls]);

  const filterControl = (c: ReferenceControl) => {
    if (activeFramework === "all") return true;
    return (c.frameworks ?? []).includes(activeFramework);
  };

  useEffect(() => {
    if (open && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [open, hasNextPage, isFetchingNextPage, fetchNextPage]);

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

  const noControls = !isLoading && allControls.length === 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Apply Control</DialogTitle>
          <DialogDescription>
            Select a control from your adopted frameworks
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {noControls && (
            <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-600" />
              <div>
                <p className="font-medium">No controls available</p>
                <p className="mt-0.5 text-amber-700">
                  Go to <span className="font-medium">Compliance → Frameworks</span> and adopt a framework first.
                </p>
              </div>
            </div>
          )}

          {frameworkTabs.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Filter by Framework</label>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => {
                    setActiveFramework("all");
                    setSelectedControl(null);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeFramework === "all"
                      ? "bg-primary text-white shadow-sm"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  All <span className="ml-1.5 opacity-75">({allControls.length})</span>
                </button>

                {frameworkTabs.map(({ code, count }) => (
                  <button
                    key={code}
                    onClick={() => {
                      setActiveFramework(code);
                      setSelectedControl(null);
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      activeFramework === code
                        ? "bg-primary text-white shadow-sm"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {code} <span className="ml-1.5 opacity-75">({count})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by control name, code, or family…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSelectedControl(null);
                }}
                className="pl-10 h-11"
              />
            </div>
          </div>

          {applyMutation.error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
              {getErrorMessage(applyMutation.error)}
            </div>
          )}

          <div className="flex-1 border-2 rounded-lg overflow-hidden bg-gray-50">
            <VirtualInfiniteList
              pages={data?.pages}
              fetchNextPage={fetchNextPage}
              hasNextPage={hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
              estimateSize={110}
              height={450}
              isLoading={isLoading}
              emptyState={
                <div className="text-center py-16 text-gray-500">
                  <Shield className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p className="font-medium text-lg">No controls found</p>
                  <p className="text-sm mt-1">Try adjusting your search or filters</p>
                </div>
              }
              renderItem={(control: ReferenceControl) => {
                if (!filterControl(control)) return null;
                
                const isSelected = selectedControl?.id === control.id;
                const frameworks = control.frameworks ?? [];

                return (
                  <button
                    key={control.id}
                    onClick={() => setSelectedControl(control)}
                    className={`w-full p-4 text-left transition-all border-b border-gray-200 ${
                      isSelected
                        ? "bg-blue-50 border-l-4 border-l-primary shadow-sm"
                        : "bg-white hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isSelected ? "bg-primary text-white" : "bg-primary/10 text-primary"
                      }`}>
                        <Shield className="h-5 w-5" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded">
                            {control.code}
                          </span>
                          <Badge className={`text-xs ${PRIORITY_STYLES[control.priority] ?? ""}`}>
                            {control.priority}
                          </Badge>
                        </div>

                        <p className="font-semibold text-gray-900 mb-1">
                          {control.name}
                        </p>

                        {control.description && (
                          <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                            {control.description}
                          </p>
                        )}

                        {activeFramework === "all" && frameworks.length > 0 && (
                          <div className="flex gap-1.5 flex-wrap">
                            {frameworks.map((fw: any) => (
                              <span
                                key={fw}
                                className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium"
                              >
                                {fw}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              }}
            />
          </div>

          {selectedControl && (
            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary text-white flex items-center justify-center flex-shrink-0">
                  <Shield className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700 mb-1">Selected Control</p>
                  <p className="font-semibold text-gray-900">{selectedControl.code} — {selectedControl.name}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={!selectedControl || applyMutation.isPending}
            className="flex-1"
          >
            {applyMutation.isPending ? (
              <>
                <Shield className="mr-2 h-4 w-4 animate-pulse" />
                Applying…
              </>
            ) : (
              <>
                <Shield className="mr-2 h-4 w-4" />
                Apply Control
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
