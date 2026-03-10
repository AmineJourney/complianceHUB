/* eslint-disable @typescript-eslint/no-unused-vars */
// frontend/src/features/controls/UnifiedControlBrowser.tsx

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { unifiedControlsApi } from "../../api/unified-controls";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function UnifiedControlBrowser() {
  const [search, setSearch] = useState("");
  const [selectedDomain, setSelectedDomain] = useState<string | undefined>();

  const { data: controls, isLoading } = useQuery({
    queryKey: ["unifiedControls", search, selectedDomain],
    queryFn: () =>
      unifiedControlsApi.getUnifiedControls({
        search,
        domain: selectedDomain,
        page_size: 50,
      }),
  });

  // Get unique domains
  const domains = React.useMemo(() => {
    const domainSet = new Set<string>();
    controls?.results.forEach((c) => domainSet.add(c.domain));
    return Array.from(domainSet);
  }, [controls]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Unified Control Library</h2>
        <p className="text-gray-600">
          Internal control library - One implementation satisfies multiple
          frameworks
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Input
          placeholder="Search controls..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* Domain Filter */}
      <div className="flex gap-2 flex-wrap">
        <Badge
          variant={!selectedDomain ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => setSelectedDomain(undefined)}
        >
          All Domains
        </Badge>
        {domains.map((domain) => (
          <Badge
            key={domain}
            variant={selectedDomain === domain ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setSelectedDomain(domain)}
          >
            {domain}
          </Badge>
        ))}
      </div>

      {/* Controls Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {controls?.results.map((control) => (
          <Card key={control.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">
                    {control.control_code}
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    {control.control_name}
                  </p>
                </div>
                <Badge variant="outline">{control.domain}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-700 mb-4 line-clamp-3">
                {control.description}
              </p>

              {/* Framework Coverage */}
              {control.framework_coverage &&
                control.framework_coverage.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-gray-600 mb-2">
                      Satisfies:
                    </p>
                    <div className="flex gap-1 flex-wrap">
                      {control.framework_coverage.map((fw) => (
                        <Badge key={fw} variant="secondary" className="text-xs">
                          {fw}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

              {/* Meta */}
              <div className="flex justify-between text-xs text-gray-500">
                <span>{control.implementation_complexity} complexity</span>
                <span>{control.implementation_count || 0} companies</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
