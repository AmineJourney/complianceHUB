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
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { ArrowLeft } from "lucide-react";
import { RISK_LEVELS } from "../../lib/constants";

export function RiskHeatMap() {
  const navigate = useNavigate();

  const { data: heatMapData, isLoading } = useQuery({
    queryKey: ["risk-heat-map"],
    queryFn: riskApi.getHeatMapData,
  });

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!heatMapData) {
    return <div>No data available</div>;
  }

  const { inherent, residual, matrix } = heatMapData;

  const getRiskColor = (score: number) => {
    if (score < matrix.low_threshold) {
      return "bg-green-500";
    } else if (score < matrix.medium_threshold) {
      return "bg-yellow-500";
    } else if (score < matrix.high_threshold) {
      return "bg-orange-500";
    } else {
      return "bg-red-500";
    }
  };

  const createHeatMapGrid = (risks: any[]) => {
    const grid: any[][] = Array(matrix.impact_levels)
      .fill(null)
      .map(() =>
        Array(matrix.likelihood_levels)
          .fill(null)
          .map(() => []),
      );

    risks.forEach((risk) => {
      const impactIndex = risk.impact - 1;
      const likelihoodIndex = risk.likelihood - 1;
      if (impactIndex >= 0 && likelihoodIndex >= 0) {
        grid[impactIndex][likelihoodIndex].push(risk);
      }
    });

    return grid;
  };

  const inherentGrid = createHeatMapGrid(inherent);
  const residualGrid = createHeatMapGrid(residual);

  const renderHeatMap = (grid: any[][], title: string) => (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Impact vs Likelihood visualization</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            {/* Column headers (Likelihood) */}
            <div className="flex mb-2">
              <div className="w-24 flex-shrink-0" />
              <div className="flex-1 flex justify-around">
                {Array.from({ length: matrix.likelihood_levels }, (_, i) => (
                  <div
                    key={i}
                    className="text-center text-sm font-medium text-gray-600 flex-1"
                  >
                    {i + 1}
                  </div>
                ))}
              </div>
            </div>

            {/* Grid */}
            <div className="flex">
              {/* Row headers (Impact) */}
              <div className="w-24 flex-shrink-0 flex flex-col-reverse">
                {Array.from({ length: matrix.impact_levels }, (_, i) => (
                  <div
                    key={i}
                    className="h-20 flex items-center justify-center text-sm font-medium text-gray-600"
                  >
                    {i + 1}
                  </div>
                ))}
              </div>

              {/* Heat map cells */}
              <div className="flex-1">
                {grid
                  .slice()
                  .reverse()
                  .map((row, rowIdx) => (
                    <div key={rowIdx} className="flex">
                      {row.map((cell, colIdx) => {
                        const impact = matrix.impact_levels - rowIdx;
                        const likelihood = colIdx + 1;
                        const score = impact * likelihood;
                        const colorClass = getRiskColor(score);

                        return (
                          <div
                            key={colIdx}
                            className={`flex-1 h-20 border border-gray-300 ${colorClass} bg-opacity-20 hover:bg-opacity-40 transition-colors cursor-pointer relative group`}
                            onClick={() => {
                              if (cell.length > 0) {
                                navigate(`/risks/${cell[0].risk_id}`);
                              }
                            }}
                          >
                            {cell.length > 0 && (
                              <>
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <span className="text-2xl font-bold text-gray-900">
                                    {cell.length}
                                  </span>
                                </div>
                                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all" />

                                {/* Tooltip */}
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                                  <div className="bg-gray-900 text-white text-xs rounded-lg p-2 whitespace-nowrap">
                                    {cell.length} risk
                                    {cell.length !== 1 ? "s" : ""} - Score:{" "}
                                    {score}
                                    <div className="mt-1 space-y-1">
                                      {cell.slice(0, 3).map((risk: any) => (
                                        <div
                                          key={risk.risk_id}
                                          className="truncate max-w-xs"
                                        >
                                          • {risk.title}
                                        </div>
                                      ))}
                                      {cell.length > 3 && (
                                        <div className="text-gray-400">
                                          +{cell.length - 3} more...
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
              </div>
            </div>

            {/* Axis labels */}
            <div className="flex mt-4">
              <div className="w-24 flex-shrink-0" />
              <div className="flex-1 text-center">
                <p className="text-sm font-medium text-gray-700">
                  Likelihood →
                </p>
              </div>
            </div>
            <div className="flex items-center mt-2">
              <div className="w-24 flex-shrink-0">
                <p className="text-sm font-medium text-gray-700 transform -rotate-90 whitespace-nowrap">
                  ← Impact
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-6 flex items-center justify-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded" />
            <span className="text-sm text-gray-700">Low</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-500 rounded" />
            <span className="text-sm text-gray-700">Medium</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-orange-500 rounded" />
            <span className="text-sm text-gray-700">High</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded" />
            <span className="text-sm text-gray-700">Critical</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/risks")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Risk Heat Map</h1>
            <p className="text-gray-600 mt-1">
              Visual representation of risk distribution
            </p>
          </div>
        </div>
      </div>

      {/* Heat Maps */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderHeatMap(inherentGrid, "Inherent Risk")}
        {renderHeatMap(residualGrid, "Residual Risk (After Controls)")}
      </div>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-gray-600">Total Risks</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {inherent.length}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Risk Reduction</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {(
                  ((inherent.reduce((sum, r) => sum + r.score, 0) -
                    residual.reduce((sum, r) => sum + r.score, 0)) /
                    inherent.reduce((sum, r) => sum + r.score, 0)) *
                  100
                ).toFixed(0)}
                %
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Avg Inherent Score</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">
                {(
                  inherent.reduce((sum, r) => sum + r.score, 0) /
                  inherent.length
                ).toFixed(1)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Avg Residual Score</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {(
                  residual.reduce((sum, r) => sum + r.score, 0) /
                  residual.length
                ).toFixed(1)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
