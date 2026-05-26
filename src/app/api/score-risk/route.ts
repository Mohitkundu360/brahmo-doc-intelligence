import { NextRequest, NextResponse } from "next/server";
import { DocumentChunk, KnowledgeNode } from "@/lib/types";
import { scoreClause } from "@/lib/risk-scorer";
import pLimit from "p-limit";

const limit = pLimit(8); // higher concurrency = faster (tune 6–10)

const KEYWORDS = [
  "liability",
  "indemn",
  "termination",
  "confidential",
  "intellectual property",
  "governing law",
  "dispute",
  "arbitration",
  "renewal",
  "damages",
  "warranty",
  "limitation",
  "ip",
];

function requiresAIAnalysis(text: string) {
  const lower = text.toLowerCase();
  return KEYWORDS.some((k) => lower.includes(k));
}

export async function POST(req: NextRequest) {
  console.time("total-risk-analysis");

  try {
    const { chunks, knowledgeNodes } = (await req.json()) as {
      chunks: DocumentChunk[];
      knowledgeNodes: KnowledgeNode[];
    };

    const apiKey = process.env.LLM_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "LLM_API_KEY not set" },
        { status: 500 }
      );
    }

    console.time("filtering");

    const scoreable = chunks.filter((chunk) => {
      const text = chunk.text.toLowerCase();
      return text.length >= 80 && requiresAIAnalysis(text);
    });

    console.timeEnd("filtering");

    console.log("Total chunks:", chunks.length);
    console.log("AI-scored chunks:", scoreable.length);

    console.time("ai-analysis");

    const results = await Promise.all(
      scoreable.map((chunk, i) =>
        limit(async () => {
          console.log(
            `Scoring clause ${i + 1}/${scoreable.length}`
          );

          try {
            return await scoreClause(
              chunk,
              knowledgeNodes,
              apiKey
            );
          } catch (err) {
            console.error("Clause failed:", err);

            return {
              chunk_id:
                chunk.id ?? String(chunk.chunk_index),
              score: 5,
              risk_level: "MEDIUM",
              risk_factors: ["AI analysis failed"],
              constraint_violations: [],
              recommendation:
                "Manual review required",
            };
          }
        })
      )
    );

    console.timeEnd("ai-analysis");

    const scoreMap = new Map<string, any>(
  results.map((s: any) => [
    s.chunk_id,
    s,
  ])
);

    const allScores = chunks.map((chunk) => {
      const id =
        chunk.id ?? String(chunk.chunk_index);

      return (
        scoreMap.get(id) ?? {
          chunk_id: id,
          score: 2,
          risk_level: "LOW",
          risk_factors: [],
          constraint_violations: [],
          recommendation:
            "Standard clause — no issues detected",
        }
      );
    });

    const summary = allScores.reduce(
  (
    acc: {
      high: number;
      medium: number;
      low: number;
    },
    s: any
  ) => {
    const level =
      s.risk_level.toLowerCase() as
        | "high"
        | "medium"
        | "low";

    acc[level]++;

    return acc;
  },
  {
    high: 0,
    medium: 0,
    low: 0,
  }
);

    console.timeEnd("total-risk-analysis");

    return NextResponse.json({
      scores: allScores,
      summary: {
        total: allScores.length,
        high: summary.high,
        medium: summary.medium,
        low: summary.low,
      },
    });
  } catch (err: unknown) {
    console.error("Risk scoring error:", err);

    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : String(err),
      },
      { status: 500 }
    );
  }
}