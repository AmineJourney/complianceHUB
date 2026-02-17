/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { riskApi } from "../../api/risk";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import {
  Plus,
  Search,
  Filter,
  Eye,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import { RISK_LEVELS } from "../../lib/constants";
import { CreateRiskDialog } from "./CreateRiskDialog";
import type { Risk } from "../../types/risk.types";

export function RiskRegister() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [levelFilter, setLevelFilter] = useState<string>("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["risks", page, search, categoryFilter, levelFilter],
    queryFn: () =>
      riskApi.getRisks({
        page,
        page_size: 20,
        search: search || undefined,
        risk_category: categoryFilter || undefined,
        inherent_risk_level: levelFilter || undefined,
      }),
  });

  const { data: summary } = useQuery({
    queryKey: ["risk-summary"],
    queryFn: riskApi.getRiskSummary,
  });

  const categories = [
    "strategic",
    "operational",
    "financial",
    "compliance",
    "reputational",
    "technology",
    "security",
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Risk Register</h1>
          <p className="text-gray-600 mt-1">
            Identify, assess, and manage organizational risks
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/risks/heat-map")}>
            <TrendingUp className="mr-2 h-4 w-4" />
            Heat Map
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Risk
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Total Risks
                  </p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {summary.total_risks}
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Critical Risks
                  </p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {summary.by_level?.find(
                      (l: any) => l.inherent_risk_level === "critical",
                    )?.count || 0}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-lg bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Avg Inherent Score
                  </p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {summary.avg_inherent_score?.toFixed(1) || 0}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Avg Residual Score
                  </p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {summary.avg_residual_score?.toFixed(1) || 0}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search risks..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>

            {/* Category filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-600">Category:</span>
              {categories.slice(0, 5).map((category) => (
                <Button
                  key={category}
                  variant={categoryFilter === category ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setCategoryFilter(
                      categoryFilter === category ? "" : category,
                    );
                    setPage(1);
                  }}
                >
                  {category}
                </Button>
              ))}
            </div>

            {/* Level filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-600">Risk Level:</span>
              {(["low", "medium", "high", "critical"] as const).map((level) => (
                <Button
                  key={level}
                  variant={levelFilter === level ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setLevelFilter(levelFilter === level ? "" : level);
                    setPage(1);
                  }}
                >
                  {RISK_LEVELS[level].label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Risks Table */}
      <Card>
        <CardHeader>
          <CardTitle>Risk Items</CardTitle>
          <CardDescription>{data?.count || 0} risks found</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingSpinner />
          ) : data?.results.length === 0 ? (
            <div className="text-center py-12">
              <AlertTriangle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No risks found</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setShowCreateDialog(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Risk
              </Button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-gray-700">
                        Risk
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">
                        Category
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">
                        Inherent Risk
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">
                        Residual Risk
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">
                        Controls
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">
                        Status
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">
                        Owner
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-gray-700">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.results.map((risk) => (
                      <tr
                        key={risk.id}
                        className="border-b hover:bg-gray-50 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-gray-900">
                              {risk.risk_id || risk.id.substring(0, 8)}
                            </p>
                            <p className="text-sm text-gray-600 truncate max-w-xs">
                              {risk.title}
                            </p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm text-gray-600 capitalize">
                            {risk.risk_category.replace("_", " ")}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Badge
                              className={
                                RISK_LEVELS[risk.inherent_risk_level].color
                              }
                            >
                              {RISK_LEVELS[risk.inherent_risk_level].label}
                            </Badge>
                            <span className="text-sm text-gray-600">
                              ({risk.inherent_risk_score})
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Badge
                              className={
                                RISK_LEVELS[
                                  risk.residual_risk_data
                                    .residual_level as keyof typeof RISK_LEVELS
                                ]?.color || "bg-gray-100 text-gray-800"
                              }
                            >
                              {RISK_LEVELS[
                                risk.residual_risk_data
                                  .residual_level as keyof typeof RISK_LEVELS
                              ]?.label ||
                                risk.residual_risk_data.residual_level}
                            </Badge>
                            <span className="text-sm text-gray-600">
                              ({risk.residual_risk_data.residual_score})
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div
                              className={`h-2 w-2 rounded-full ${
                                risk.residual_risk_data.control_count > 0
                                  ? "bg-green-500"
                                  : "bg-gray-300"
                              }`}
                            />
                            <span className="text-sm text-gray-600">
                              {risk.residual_risk_data.control_count}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="secondary" className="capitalize">
                            {risk.status.replace("_", " ")}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm text-gray-600">
                            {risk.risk_owner_email || "—"}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => navigate(`/risks/${risk.id}`)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {data && data.count > 20 && (
                <div className="flex items-center justify-between mt-6">
                  <p className="text-sm text-gray-600">
                    Showing {(page - 1) * 20 + 1} to{" "}
                    {Math.min(page * 20, data.count)} of {data.count} risks
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setPage(page - 1)}
                      disabled={!data.previous}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setPage(page + 1)}
                      disabled={!data.next}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Create Risk Dialog */}
      <CreateRiskDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSuccess={() => {
          setShowCreateDialog(false);
          refetch();
        }}
      />
    </div>
  );
}
