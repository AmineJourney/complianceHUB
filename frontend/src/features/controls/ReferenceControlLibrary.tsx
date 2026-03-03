/* eslint-disable @typescript-eslint/no-unused-expressions */
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { controlsApi } from "../../api/controls";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import {
  Search,
  Shield,
  ChevronDown,
  ChevronRight,
  Library,
} from "lucide-react";
import type { ReferenceControl } from "../../types/control.types";

// ─── Style maps ──────────────────────────────────────────────────────────────

const PRIORITY_STYLES: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  low: "bg-gray-100 text-gray-600 border-gray-200",
};

const TYPE_STYLES: Record<string, string> = {
  preventive: "bg-blue-100 text-blue-700",
  detective: "bg-purple-100 text-purple-700",
  corrective: "bg-green-100 text-green-700",
  deterrent: "bg-pink-100 text-pink-700",
  compensating: "bg-teal-100 text-teal-700",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ReferenceControlLibrary() {
  const [search, setSearch] = useState("");
  const [selectedLibrary, setSelectedLibrary] = useState<string | null>(null);
  const [expandedLibraries, setExpandedLibraries] = useState<Set<string>>(
    new Set(),
  );

  const { data, isLoading } = useQuery({
    queryKey: ["reference-controls-library", search],
    queryFn: () =>
      controlsApi.getReferenceControls({
        search: search || undefined,
        page_size: 500,
      }),
  });

  // Group controls by library name
  const grouped = useMemo(() => {
    const controls = data?.results ?? [];
    const map: Record<string, ReferenceControl[]> = {};

    controls.forEach((control) => {
      const libs = control.library_names?.length
        ? control.library_names
        : ["Unassigned"];

      libs.forEach((lib) => {
        if (!map[lib]) map[lib] = [];
        map[lib].push(control);
      });
    });

    return Object.fromEntries(
      Object.entries(map).sort(([a], [b]) => a.localeCompare(b)),
    );
  }, [data]);

  const allLibraries = Object.keys(grouped);

  // If a library is selected in the sidebar, show only that group
  const displayedGroups = selectedLibrary
    ? { [selectedLibrary]: grouped[selectedLibrary] ?? [] }
    : grouped;

  const totalControls = data?.count ?? 0;

  const toggleLibrary = (lib: string) => {
    setExpandedLibraries((prev) => {
      const next = new Set(prev);
      next.has(lib) ? next.delete(lib) : next.add(lib);
      return next;
    });
  };

  const expandAll = () => setExpandedLibraries(new Set(allLibraries));

  const collapseAll = () => setExpandedLibraries(new Set());

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Reference Control Library
        </h1>
        <p className="text-gray-600 mt-1">
          Browse all controls across every imported framework library
        </p>
      </div>

      <div className="flex gap-6">
        {/* ── Sidebar ───────────────────────────────────────────────────── */}
        <aside className="w-56 flex-shrink-0 space-y-1">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 mb-3">
            Libraries
          </p>

          {/* "All" button */}
          <button
            onClick={() => setSelectedLibrary(null)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedLibrary === null
                ? "bg-primary text-white"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            All Libraries
            <span className="ml-1 text-xs opacity-70">({totalControls})</span>
          </button>

          {/* Per-library buttons */}
          {allLibraries.map((lib) => (
            <button
              key={lib}
              onClick={() => setSelectedLibrary(lib)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                selectedLibrary === lib
                  ? "bg-primary text-white"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <div className="flex items-center gap-2">
                <Library className="h-3.5 w-3.5 flex-shrink-0 opacity-70" />
                <span className="truncate">{lib}</span>
              </div>
              <span
                className={`ml-6 text-xs ${
                  selectedLibrary === lib ? "opacity-70" : "text-gray-400"
                }`}
              >
                {grouped[lib]?.length ?? 0} control
                {grouped[lib]?.length !== 1 ? "s" : ""}
              </span>
            </button>
          ))}
        </aside>

        {/* ── Main content ──────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Search + expand/collapse toolbar */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search controls by name, code, or family…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            {search && (
              <Button variant="ghost" size="sm" onClick={() => setSearch("")}>
                Clear
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={expandAll}>
              Expand all
            </Button>
            <Button variant="outline" size="sm" onClick={collapseAll}>
              Collapse all
            </Button>
          </div>

          {/* Content */}
          {isLoading ? (
            <LoadingSpinner />
          ) : totalControls === 0 ? (
            <Card>
              <CardContent className="py-20 text-center text-gray-500">
                <Shield className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="font-medium text-gray-700">No controls found</p>
                <p className="text-sm mt-1">
                  {search
                    ? "Try a different search term."
                    : "Run an import command to load framework libraries."}
                </p>
              </CardContent>
            </Card>
          ) : (
            Object.entries(displayedGroups).map(([libName, controls]) => (
              <LibrarySection
                key={libName}
                libraryName={libName}
                controls={controls}
                isExpanded={expandedLibraries.has(libName)}
                onToggle={() => toggleLibrary(libName)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Library Section ──────────────────────────────────────────────────────────

interface LibrarySectionProps {
  libraryName: string;
  controls: ReferenceControl[];
  isExpanded: boolean;
  onToggle: () => void;
}

function LibrarySection({
  libraryName,
  controls,
  isExpanded,
  onToggle,
}: LibrarySectionProps) {
  return (
    <Card className="overflow-hidden">
      {/* Collapsible header */}
      <CardHeader
        className="cursor-pointer select-none bg-gray-50 hover:bg-gray-100 transition-colors py-3 px-4"
        onClick={onToggle}
      >
        <CardTitle className="flex items-center justify-between text-sm font-semibold text-gray-700">
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-500" />
            )}
            <Library className="h-4 w-4 text-primary" />
            <span>{libraryName}</span>
          </div>
          <Badge variant="secondary" className="text-xs font-normal">
            {controls.length} control{controls.length !== 1 ? "s" : ""}
          </Badge>
        </CardTitle>
      </CardHeader>

      {isExpanded && (
        <CardContent className="p-0">
          <div className="divide-y">
            {controls.map((control) => (
              <ControlRow key={control.id} control={control} />
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ─── Control Row ──────────────────────────────────────────────────────────────

function ControlRow({ control }: { control: ReferenceControl }) {
  return (
    <div className="p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Shield className="h-4 w-4 text-primary" />
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            {/* Left: code + name + description + framework pills */}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                  {control.code}
                </span>
                <p className="font-medium text-gray-900 text-sm">
                  {control.name}
                </p>
              </div>

              {control.description && (
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                  {control.description}
                </p>
              )}

              {/* Framework pills */}
              {control.frameworks?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {control.frameworks.map((fw) => (
                    <span
                      key={fw}
                      className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.5 rounded"
                    >
                      {fw}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Right: badges */}
            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
              <Badge
                className={`text-xs border ${
                  PRIORITY_STYLES[control.priority] ??
                  "bg-gray-100 text-gray-600"
                }`}
              >
                {control.priority}
              </Badge>
              <Badge
                className={`text-xs ${
                  TYPE_STYLES[control.control_type] ??
                  "bg-gray-100 text-gray-600"
                }`}
              >
                {control.control_type}
              </Badge>
              <span className="text-xs text-gray-400 capitalize">
                {control.control_family?.replace(/_/g, " ")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
