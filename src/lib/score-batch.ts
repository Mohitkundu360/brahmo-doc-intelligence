import OpenAI from "openai";
import { DocumentChunk, KnowledgeNode } from "@/lib/types";

const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.LLM_API_KEY,
});

// ----------------------------
// RULE ENGINE
// ----------------------------

function detectRuleViolations(text: string) {
  const lower = text.toLowerCase();

  const violations: {
    code: string;
    severity: string;
    reason: string;
  }[] = [];

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

  // Non-compete / non-solicit > 12 months
  if (
    (lower.includes("24 months") ||
      lower.includes("18 months") ||
      lower.includes("36 months")) &&
    (
      lower.includes("non-compete") ||
      lower.includes("non solicitation") ||
      lower.includes("non-solicitation") ||
      lower.includes("non solicit") ||
      lower.includes("non-solicit")
    )
  ) {
    violations.push({
      code: "C-011",
      severity: "HIGH",
      reason:
        "Non-compete or non-solicitation exceeds 12 month limit",
    });
  }

  // Missing arbitration protection
  if (
    lower.includes("exclusive jurisdiction") &&
    !lower.includes("arbitration")
  ) {
    violations.push({
      code: "C-013",
      severity: "MEDIUM",
      reason:
        "Litigation preferred over arbitration",
    });
  }

  // Broad IP assignment
  if (
    lower.includes("all intellectual property") &&
    !lower.includes("pre-existing")
  ) {
    violations.push({
      code: "C-012",
      severity: "HIGH",
      reason:
        "Broad IP assignment without carve-out",
    });
  }

  return violations;
}

export async function scoreBatch(
  chunks: DocumentChunk[],
  knowledgeNodes: KnowledgeNode[],
  apiKey?: string
) {
  const results = [];

  for (const chunk of chunks) {
    try {
      console.log(
        "Scoring:",
        chunk.text.slice(0, 50)
      );

      // ----------------------------
      // RUN RULE ENGINE FIRST
      // ----------------------------

      const violations =
        detectRuleViolations(chunk.text);

      if (violations.length > 0) {
        results.push({
          chunk_id:
            chunk.id ??
            String(chunk.chunk_index),

          score: 9,

          risk_level: "HIGH",

          risk_factors: violations.map(
            (v) => v.reason
          ),

          constraint_violations:
            violations.map((v) => v.code),

          recommendation:
            "Legal review required due to policy violations",
        });

        continue;
      }

      // ----------------------------
      // AI ANALYSIS
      // ----------------------------

      const completion =
        await client.chat.completions.create({
          model: "openai/gpt-4o-mini",

          messages: [
            {
              role: "system",
              content: `
You are a legal AI risk analyzer.

Analyze contract clauses for:
- risk level
- legal issues
- policy violations
- recommendations
`,
            },

            {
              role: "user",
              content: `
You are an expert legal contract risk analyzer.

Analyze the clause carefully.

Scoring rules:

LOW (1-3):
- Standard legal wording
- No major risk
- Matches firm policy

MEDIUM (4-6):
- Potentially negotiable
- Missing protections
- Slightly one-sided
- Requires legal review

HIGH (7-10):
- Severe legal exposure
- Violates firm policy
- Unlimited liability
- Dangerous indemnity
- Excessive non-compete
- Missing dispute protection

Firm Knowledge:
${JSON.stringify(
  knowledgeNodes,
  null,
  2
)}

Clause:
${chunk.text}

Return STRICT JSON ONLY:

{
  "score": 1-10,
  "risk_level": "LOW" | "MEDIUM" | "HIGH",
  "risk_factors": [],
  "constraint_violations": [],
  "recommendation": ""
}
`,
            },
          ],

          temperature: 0.2,
        });

      const content =
        completion.choices[0].message.content;

      let parsed;

      try {
        parsed = JSON.parse(content || "{}");
      } catch {
        parsed = {
          score: 5,
          risk_level: "MEDIUM",
          risk_factors: [
            "Invalid AI JSON response",
          ],
          constraint_violations: [],
          recommendation:
            "Manual review required",
        };
      }

      results.push({
        chunk_id:
          chunk.id ??
          String(chunk.chunk_index),

        ...parsed,
      });
    } catch (error) {
      console.error(
        "Failed scoring chunk:",
        chunk.text.slice(0, 50),
        error
      );

      results.push({
        chunk_id:
          chunk.id ??
          String(chunk.chunk_index),

        score: 5,

        risk_level: "MEDIUM",

        risk_factors: [
          "AI analysis failed",
        ],

        constraint_violations: [],

        recommendation:
          "Manual review required",
      });
    }
  }

  return results;
}