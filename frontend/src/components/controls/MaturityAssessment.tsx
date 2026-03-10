// frontend/src/components/controls/MaturityAssessment.tsx
// FIXED VERSION - Proper TypeScript types for maturity levels

import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { unifiedControlsApi } from "../../api/unified-controls";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { AppliedControl } from "../../types/control.types";

interface MaturityAssessmentProps {
  appliedControl: AppliedControl;
}

// ✅ FIX: Define maturity level type
type MaturityLevel = 1 | 2 | 3 | 4 | 5;

const MATURITY_LEVELS: Array<{
  level: MaturityLevel;
  label: string;
  color: string;
}> = [
  {
    level: 1,
    label: "Level 1 - Initial/Ad-hoc",
    color: "bg-red-100 text-red-800",
  },
  {
    level: 2,
    label: "Level 2 - Managed",
    color: "bg-orange-100 text-orange-800",
  },
  {
    level: 3,
    label: "Level 3 - Defined",
    color: "bg-yellow-100 text-yellow-800",
  },
  {
    level: 4,
    label: "Level 4 - Quantitatively Managed",
    color: "bg-blue-100 text-blue-800",
  },
  {
    level: 5,
    label: "Level 5 - Optimizing",
    color: "bg-green-100 text-green-800",
  },
];

export function MaturityAssessment({
  appliedControl,
}: MaturityAssessmentProps) {
  // ✅ FIX: Explicitly type the state as MaturityLevel
  const [selectedLevel, setSelectedLevel] = useState<MaturityLevel>(
    appliedControl.maturity_level,
  );
  const [notes, setNotes] = useState(appliedControl.maturity_notes || "");
  const queryClient = useQueryClient();

  const assessMutation = useMutation({
    mutationFn: (data: {
      maturity_level: MaturityLevel;
      maturity_notes: string;
    }) => unifiedControlsApi.assessMaturity(appliedControl.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appliedControls"] });
      queryClient.invalidateQueries({ queryKey: ["maturitySummary"] });
    },
  });

  const handleAssess = () => {
    // ✅ FIX: No type assertion needed now
    assessMutation.mutate({
      maturity_level: selectedLevel,
      maturity_notes: notes,
    });
  };

  const currentLevelInfo = MATURITY_LEVELS.find(
    (l) => l.level === appliedControl.maturity_level,
  );
  const targetLevelInfo = MATURITY_LEVELS.find(
    (l) => l.level === appliedControl.maturity_target_level,
  );

  return (
    <div className="space-y-6">
      {/* Current Status */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">
            Current Maturity
          </label>
          <Badge className={currentLevelInfo?.color}>
            {currentLevelInfo?.label}
          </Badge>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">
            Target Maturity
          </label>
          <Badge className={targetLevelInfo?.color}>
            {targetLevelInfo?.label}
          </Badge>
        </div>
      </div>

      {/* Maturity Criteria */}
      {appliedControl.maturity_criteria && (
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">
              Current Level Criteria
            </h4>
            <p className="text-sm text-blue-800">
              {appliedControl.maturity_criteria.current_criteria}
            </p>
          </div>

          {appliedControl.maturity_criteria.next_level <= 5 && (
            <div className="p-4 bg-green-50 rounded-lg">
              <h4 className="font-medium text-green-900 mb-2">
                Next Level Criteria (Level{" "}
                {appliedControl.maturity_criteria.next_level})
              </h4>
              <p className="text-sm text-green-800">
                {appliedControl.maturity_criteria.next_criteria}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Assessment Form */}
      <div className="space-y-4 border-t pt-4">
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            Assess Maturity Level
          </label>
          <div className="grid grid-cols-5 gap-2">
            {MATURITY_LEVELS.map((ml) => (
              <button
                key={ml.level}
                onClick={() => setSelectedLevel(ml.level)}
                className={`
                  p-3 rounded-lg text-center transition-all
                  ${
                    selectedLevel === ml.level
                      ? "ring-2 ring-primary scale-105"
                      : "hover:scale-102"
                  }
                  ${ml.color}
                `}
              >
                <div className="font-bold">L{ml.level}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            Assessment Notes
          </label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Describe the current maturity level and evidence..."
            rows={4}
          />
        </div>

        <Button
          onClick={handleAssess}
          disabled={assessMutation.isPending}
          className="w-full"
        >
          {assessMutation.isPending ? "Saving..." : "Save Maturity Assessment"}
        </Button>
      </div>
    </div>
  );
}
