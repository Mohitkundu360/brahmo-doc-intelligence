export interface ClauseRisk {
  clause_title: string;

  score: number;

  risk_level:
    | "LOW"
    | "MEDIUM"
    | "HIGH";

  constraint_violations?: string[];

  risk_factors?: string[];
}

function getBaseWeight(
  level: ClauseRisk["risk_level"]
) {
  switch (level) {
    case "HIGH":
      return 10;

    case "MEDIUM":
      return 5;

    case "LOW":
      return 1;

    default:
      return 0;
  }
}

export function calculateClauseRisk(
  clause: ClauseRisk
) {
  let total = getBaseWeight(
    clause.risk_level
  );

  total +=
    (clause.constraint_violations
      ?.length || 0) * 5;

  total +=
    (clause.risk_factors?.length || 0) *
    2;

  return total;
}

export function calculateTotalRisk(
  clauses: ClauseRisk[]
) {
  return clauses.reduce(
    (sum, clause) =>
      sum +
      calculateClauseRisk(clause),
    0
  );
}