export function detectRuleViolations(
  text: string
) {
  const lower = text.toLowerCase();

  const violations = [];

  // Unlimited liability
  if (
    lower.includes("unlimited liability") ||
    lower.includes("no limitation of liability")
  ) {
    violations.push({
      code: "C-010",
      severity: "HIGH",
      reason:
        "Unlimited liability violates firm policy",
    });
  }

  // Non-compete > 12 months
  if (
    lower.includes("24 months") &&
    (
      lower.includes("non-compete") ||
      lower.includes("non-solicit")
    )
  ) {
    violations.push({
      code: "C-011",
      severity: "HIGH",
      reason:
        "Non-compete exceeds 12 month limit",
    });
  }

  return violations;
}