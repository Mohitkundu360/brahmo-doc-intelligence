import { ComparisonResult, KnowledgeNode } from "./types";

export type NegotiationAction = "ACCEPT" | "COUNTER" | "REJECT" | "REVIEW";

export interface NegotiationSuggestion {
  clause_title: string;
  clause_number: string;
  action: NegotiationAction;
  reason: string;
  counter_text?: string; // what to propose instead
  triggered_constraint?: string;
}

const COUNTER_TEMPLATES: Record<string, string> = {
  "C-010": 'Counter: "Liability shall be capped at 2x the annual contract value."',
  "C-011": 'Counter: Reduce duration to 12 months maximum per firm policy.',
  "C-012": 'Counter: Add carve-out — "excluding any pre-existing IP of the Receiving Party."',
  "C-013": 'Counter: Restore SIAC arbitration clause — "disputes settled by arbitration under SIAC Rules, Singapore."',
  "C-014": 'Counter: Extend notice period to minimum 90 days per firm policy.',
  "AP-010": 'Counter: Replace with mutual indemnification — both parties indemnify each other.',
  "AP-011": 'Counter: Extend opt-out window to minimum 90 days.',
  "D-010": 'Counter: Add return of materials clause — "all materials returned/destroyed within 7 days of termination."',
  "D-011": 'Counter: Reduce LD amount to reflect proportionate estimated actual loss.',
  "D-012": 'Counter: Specify SIAC Singapore as dispute resolution forum.',
};

export function generateNegotiationAdvice(
  comparisonResults: ComparisonResult[],
  knowledgeNodes: KnowledgeNode[]
): NegotiationSuggestion[] {
  const suggestions: NegotiationSuggestion[] = [];

  for (const result of comparisonResults) {
    if (result.match_type === "UNCHANGED") continue;

    const chunk = result.chunk_v2 ?? result.chunk_v1;
    if (!chunk) continue;

    const clauseTitle = chunk.clause_title;
    const clauseNumber = chunk.clause_number;
    const text = chunk.text.toLowerCase();

    // Find violated constraints from risk score data
    // Fall back to heuristic keyword matching if no score data
    const violatedNodes: KnowledgeNode[] = [];

    for (const node of knowledgeNodes) {
      const violated = checkConstraintViolation(text, node);
      if (violated) violatedNodes.push(node);
    }

    if (result.match_type === "REMOVED") {
      // Removed clauses that had protection (arbitration, return of materials)
      const wasProtective = checkWasProtective(chunk.text, knowledgeNodes);
      if (wasProtective) {
        suggestions.push({
          clause_title: clauseTitle,
          clause_number: clauseNumber,
          action: "REJECT",
          reason: `Clause removed — previously provided protection. Removal increases risk.`,
          triggered_constraint: wasProtective,
          counter_text: COUNTER_TEMPLATES[wasProtective],
        });
      }
      continue;
    }

    if (violatedNodes.length === 0) {
      // No constraint violations — check if change is beneficial
      if (result.risk_delta === "DECREASED") {
        suggestions.push({
          clause_title: clauseTitle,
          clause_number: clauseNumber,
          action: "ACCEPT",
          reason: `Change reduces risk. No firm policy violations detected.`,
        });
      } else if (result.match_type === "ADDED" && result.score_v2 && result.score_v2 >= 7) {
        suggestions.push({
          clause_title: clauseTitle,
          clause_number: clauseNumber,
          action: "REJECT",
          reason: `New clause is HIGH risk (${result.score_v2}/10). Negotiate removal or significant revision.`,
        });
      } else {
        suggestions.push({
          clause_title: clauseTitle,
          clause_number: clauseNumber,
          action: "REVIEW",
          reason: `Modified clause — no constraint violations but review advised.`,
        });
      }
    } else {
      // Has violations — REJECT if multiple, COUNTER if one fixable issue
      const primaryNode = violatedNodes[0];
      const action = violatedNodes.length >= 2 ? "REJECT" : "COUNTER";

      suggestions.push({
        clause_title: clauseTitle,
        clause_number: clauseNumber,
        action,
        reason: `Violates firm policy [${violatedNodes.map((n) => n.id).join(", ")}]: ${violatedNodes.map((n) => n.title).join("; ")}.`,
        triggered_constraint: primaryNode.id,
        counter_text: COUNTER_TEMPLATES[primaryNode.id],
      });
    }
  }

  // Sort: REJECT first, then COUNTER, REVIEW, ACCEPT
  const order: Record<NegotiationAction, number> = { REJECT: 0, COUNTER: 1, REVIEW: 2, ACCEPT: 3 };
  return suggestions.sort((a, b) => order[a.action] - order[b.action]);
}

function checkConstraintViolation(text: string, node: KnowledgeNode): boolean {
  switch (node.id) {
    case "C-010": return /unlimited.{0,30}liabilit|no.{0,10}cap.{0,20}liabilit|liabilit.{0,30}unlimited/i.test(text);
    case "C-011": return /(\d{2,})\s*month/i.test(text) && (parseInt(text.match(/(\d{2,})\s*month/i)?.[1] ?? "0") > 12) && /non.solicit|non.compet/i.test(text);
    case "C-012": return /all.{0,30}ip|all.{0,30}intellectual property/i.test(text) && !/carve.out|pre.existing|background ip/i.test(text);
    case "C-013": return /courts? of|exclusive jurisdiction|litigation/i.test(text) && !/arbitrat/i.test(text);
    case "C-014": return /(\d+)\s*days?.{0,20}notice/i.test(text) && (parseInt(text.match(/(\d+)\s*days?.{0,20}notice/i)?.[1] ?? "999") < 90);
    case "AP-010": return /one.direction|disclosing party.{0,50}no.{0,20}indemnif|sole.{0,20}indemnif/i.test(text);
    case "AP-011": return /auto.renew/i.test(text) && /(\d+)\s*days/i.test(text) && (parseInt(text.match(/(\d+)\s*days/i)?.[1] ?? "999") < 90);
    default: return false;
  }
}

function checkWasProtective(text: string, nodes: KnowledgeNode[]): string | null {
  if (/arbitrat/i.test(text)) return "C-013";
  if (/return.{0,20}material|destroy.{0,20}confidential/i.test(text)) return "D-010";
  return null;
}
