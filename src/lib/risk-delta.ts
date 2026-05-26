import {
  calculateClauseRisk,
  calculateTotalRisk,
} from "./risk-score";

export function compareRisk(
  originalClauses: any[],
  revisedClauses: any[]
) {
  const originalRisk =
    calculateTotalRisk(
      originalClauses
    );

  const revisedRisk =
    calculateTotalRisk(
      revisedClauses
    );

  const delta =
    revisedRisk - originalRisk;

  let status = "UNCHANGED";

  if (delta > 0) {
    status = "INCREASED";
  }

  if (delta < 0) {
    status = "REDUCED";
  }

  return {
    originalRisk,
    revisedRisk,
    delta,
    status,
  };
}