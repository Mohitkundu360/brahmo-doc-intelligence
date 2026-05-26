import {
  DocumentChunk,
  KnowledgeNode,
  RiskScore,
  ConstraintViolation,
} from "./types";

const RISK_RUBRIC = `
- Uncapped liability: HIGH
- One-sided indemnification: MEDIUM/HIGH
- Non-compete >12 months: HIGH
- Missing IP carve-out: MEDIUM
- Missing arbitration: MEDIUM
- Short termination notice: MEDIUM
`;

// ─────────────────────────────────────────────────────────────
// Numeric extraction intelligence
// Prevent OCR merge corruption issues like:
// "1812 months" / "3090 days"
// ─────────────────────────────────────────────────────────────

function extractNumber(
  text: string,
  keyword: string
): number | null {
  const normalized = text
    .replace(/\s+/g, " ")
    .toLowerCase();

  // Look both BEFORE and AFTER keyword
  const patterns = [
    new RegExp(
      `(\\d+)\\s*(days|months)?.{0,20}${keyword}`,
      "i"
    ),

    new RegExp(
      `${keyword}.{0,20}(\\d+)\\s*(days|months)?`,
      "i"
    ),
  ];

  for (const regex of patterns) {
    const match = normalized.match(regex);

    if (!match) {
      continue;
    }

    const raw = parseInt(match[1]);

    if (Number.isNaN(raw)) {
      continue;
    }

    // OCR corruption protection
    // 1812 -> 18
    // 3090 -> 30
    if (
      raw > 100 &&
      (
        keyword.includes("non-compete") ||
        keyword.includes("termination")
      )
    ) {
      const shortened = parseInt(
        String(raw).slice(0, 2)
      );

      return Number.isNaN(shortened)
        ? raw
        : shortened;
    }

    return raw;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────
// Triggered constraint detection
// ─────────────────────────────────────────────────────────────

function findTriggeredConstraints(
  clauseText: string,
  knowledgeNodes: KnowledgeNode[]
): KnowledgeNode[] {
  const text = clauseText.toLowerCase();

  return knowledgeNodes.filter((node) => {
    const content =
      `${node.title} ${node.content}`.toLowerCase();

    // LIABILITY
    if (
      content.includes("liability") &&
      (
        text.includes("unlimited liability") ||
        text.includes("uncapped liability")
      )
    ) {
      return true;
    }

    // NON-COMPETE
    if (
      content.includes("non-compete") ||
      content.includes("non-solicitation")
    ) {
      const months = extractNumber(
        text,
        "non-compete"
      );

      if (months && months > 12) {
        return true;
      }
    }

    // ARBITRATION
    if (
      content.includes("arbitration") &&
      (
        text.includes("courts of") ||
        text.includes("litigation") ||
        text.includes("exclusive jurisdiction")
      ) &&
      !text.includes("arbitration")
    ) {
      return true;
    }

    // TERMINATION
    if (
      content.includes("termination")
    ) {
      const days = extractNumber(
        text,
        "termination"
      );

      if (days && days < 90) {
        return true;
      }
    }

    // IP
    if (
      content.includes("ip") ||
      content.includes("intellectual property")
    ) {
      if (
        (
          text.includes("all ip") ||
          text.includes(
            "all intellectual property"
          )
        ) &&
        !text.includes("pre-existing")
      ) {
        return true;
      }
    }

    return false;
  });
}

// ─────────────────────────────────────────────────────────────
// Relevance filtering
// ─────────────────────────────────────────────────────────────

function getRelevantKnowledge(
  clauseText: string,
  knowledgeNodes: KnowledgeNode[]
) {
  const text = clauseText.toLowerCase();

  return knowledgeNodes.filter((node) => {
    const content =
      `${node.title} ${node.content}`.toLowerCase();

    if (
      text.includes("liability") &&
      content.includes("liability")
    ) {
      return true;
    }

    if (
      text.includes("termination") &&
      content.includes("termination")
    ) {
      return true;
    }

    if (
      text.includes("intellectual property") &&
      (
        content.includes("ip") ||
        content.includes(
          "intellectual property"
        )
      )
    ) {
      return true;
    }

    if (
      text.includes("non-compete") &&
      content.includes("non-compete")
    ) {
      return true;
    }

    if (
      text.includes("arbitration") &&
      content.includes("arbitration")
    ) {
      return true;
    }

    if (
      text.includes("confidential") &&
      content.includes("confidential")
    ) {
      return true;
    }

    return false;
  });
}

// ─────────────────────────────────────────────────────────────
// LLM
// ─────────────────────────────────────────────────────────────

async function callLLM(
  prompt: string,
  apiKey: string
): Promise<string> {
  // OpenRouter
  if (apiKey.startsWith("sk-or-")) {
    const res = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer":
            "http://localhost:3000",
          "X-Title":
            "BRAHMO Document Intelligence",
        },
        body: JSON.stringify({
          model:
            "google/gemini-2.0-flash-001",

          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],

          temperature: 0.1,
          max_tokens: 220,
        }),
      }
    );

    if (!res.ok) {
      throw new Error(
        `OpenRouter Error: ${await res.text()}`
      );
    }

    const data = await res.json();

    return (
      data?.choices?.[0]?.message
        ?.content ?? ""
    );
  }

  // Gemini direct
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",

    headers: {
      "Content-Type":
        "application/json",
    },

    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],

      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 220,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(
      `Gemini Error: ${await res.text()}`
    );
  }

  const data = await res.json();

  return (
    data?.candidates?.[0]?.content
      ?.parts?.[0]?.text ?? ""
  );
}

// ─────────────────────────────────────────────────────────────
// Main scoring
// ─────────────────────────────────────────────────────────────

export async function scoreClause(
  chunk: DocumentChunk,
  knowledgeNodes: KnowledgeNode[],
  apiKey: string
): Promise<RiskScore> {
  const relevantKnowledge =
    getRelevantKnowledge(
      chunk.text,
      knowledgeNodes
    );

  const triggeredConstraints =
    findTriggeredConstraints(
      chunk.text,
      knowledgeNodes
    );

  const constraintText =
    relevantKnowledge
      .slice(0, 5)
      .map(
        (n) =>
          `[${n.id}] ${n.node_type}: ${n.title}`
      )
      .join("\n");

  const prompt = `
You are a legal contract risk analyst.

Analyze this contract clause for legal risk.

IMPORTANT:
- Firm constraints OVERRIDE generic scoring
- If policy violations exist, increase score appropriately
- Return ONLY triggered violations

FIRM KNOWLEDGE:
${constraintText}

RISK RUBRIC:
${RISK_RUBRIC}

CLAUSE:
Title: ${chunk.clause_title}

Text:
${chunk.text}

Respond ONLY valid JSON:

{
  "score": 1,
  "risk_factors": [],
  "constraint_violations": [],
  "recommendation": ""
}
`;

  const rawText = await callLLM(
    prompt,
    apiKey
  );

  let parsed: {
    score: number;
    risk_factors: string[];
    constraint_violations: ConstraintViolation[];
    recommendation: string;
  };

  try {
    const clean = rawText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    parsed = JSON.parse(clean);
  } catch {
    parsed = {
      score: 3,

      risk_factors: [
        "Unable to parse AI response",
      ],

      constraint_violations: [],

      recommendation:
        "Manual legal review recommended.",
    };
  }

  let score = parsed.score || 3;

  const text =
    chunk.text.toLowerCase();

  parsed.risk_factors =
    parsed.risk_factors || [];

  parsed.constraint_violations =
    parsed.constraint_violations || [];

  // LIABILITY

  if (
    text.includes("unlimited liability") ||
    text.includes("uncapped liability")
  ) {
    score = Math.max(score, 8);

    parsed.risk_factors.push(
      "Uncapped liability exposure detected"
    );

    parsed.constraint_violations.push({
      node_id: "C-010",
      node_title:
        "Liability Cap Policy",
      reason:
        "Liability cap missing",
    });

    parsed.recommendation =
      "Add liability cap limited to 2x annual contract value.";
  }

  // NON-COMPETE

  const months = extractNumber(
    text,
    "non-compete"
  );

  if (
    text.includes("non-compete") &&
    months &&
    months > 12
  ) {
    score = Math.max(score, 7);

    parsed.risk_factors.push(
      "Non-compete exceeds 12 month policy limit"
    );

    parsed.constraint_violations.push({
      node_id: "C-011",
      node_title:
        "Non-Compete Policy",
      reason:
        "Restriction exceeds 12 months",
    });

    parsed.recommendation =
      "Reduce non-compete duration to 12 months or less.";
  }

  // IP

  if (
    (
      text.includes("all ip") ||
      text.includes(
        "all intellectual property"
      )
    ) &&
    !text.includes("pre-existing")
  ) {
    score = Math.max(score, 6);

    parsed.risk_factors.push(
      "Broad IP assignment without carve-out"
    );

    parsed.constraint_violations.push({
      node_id: "C-012",
      node_title:
        "IP Carve-Out Requirement",
      reason:
        "Pre-existing IP carve-out missing",
    });

    parsed.recommendation =
      "Add carve-out for pre-existing IP.";
  }

  // ARBITRATION

  if (
    (
      text.includes(
        "exclusive jurisdiction"
      ) ||
      text.includes("litigation")
    ) &&
    !text.includes("arbitration")
  ) {
    score = Math.max(score, 6);

    parsed.risk_factors.push(
      "Arbitration clause missing"
    );

    parsed.constraint_violations.push({
      node_id: "C-013",
      node_title:
        "Arbitration Preference",
      reason:
        "Litigation preferred over arbitration",
    });

    parsed.recommendation =
      "Use SIAC or LCIA arbitration clause.";
  }

  // TERMINATION

  const days = extractNumber(
    text,
    "termination"
  );

  if (
    text.includes("termination") &&
    days &&
    days < 90
  ) {
    score = Math.max(score, 6);

    parsed.risk_factors.push(
      "Termination notice below policy threshold"
    );

    parsed.constraint_violations.push({
      node_id: "C-014",
      node_title:
        "Termination Notice Policy",
      reason:
        "Minimum 90 days required",
    });

    parsed.recommendation =
      "Increase termination notice to 90 days.";
  }

  // Deduplicate

  parsed.constraint_violations =
    parsed.constraint_violations.filter(
      (value, index, self) =>
        index ===
        self.findIndex(
          (v) => v.node_id === value.node_id
        )
    );

  // Normalize

  score = Math.max(
    1,
    Math.min(10, Math.round(score))
  );

  return {
    chunk_id:
      chunk.id ??
      String(chunk.chunk_index),

    score,

    risk_level:
      score <= 3
        ? "LOW"
        : score <= 6
        ? "MEDIUM"
        : "HIGH",

    risk_factors:
      parsed.risk_factors,

    constraint_violations:
      parsed.constraint_violations,

    recommendation:
      parsed.recommendation ||
      "Manual legal review recommended.",
  };
}

// ─────────────────────────────────────────────────────────────
// Risk delta stabilization
// ─────────────────────────────────────────────────────────────

export function computeRiskDelta(
  score1: number,
  score2: number,
  similarity = 0
): "INCREASED" | "DECREASED" | "UNCHANGED" {

  if (similarity >= 0.97) {
    return "UNCHANGED";
  }

  if (score2 > score1 + 0.5) {
    return "INCREASED";
  }

  if (score2 < score1 - 0.5) {
    return "DECREASED";
  }

  return "UNCHANGED";
}

// ─────────────────────────────────────────────────────────────
// Weighted risk scoring
// ─────────────────────────────────────────────────────────────

export function calculateWeightedRiskDelta(
  oldScore: number,
  newScore: number
): number {
  return newScore - oldScore;
}