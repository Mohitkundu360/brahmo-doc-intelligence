// src/app/api/compare/route.ts

import { NextRequest, NextResponse } from "next/server";

import { compareClauses } from "@/lib/clause-comparator";

import {
  scoreClause,
  calculateWeightedRiskDelta,
} from "@/lib/risk-scorer";

import {
  DocumentChunk,
  KnowledgeNode,
  ComparisonResult,
} from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const {
      chunksV1,
      chunksV2,
      knowledgeNodes,
    } = (await req.json()) as {
      chunksV1: DocumentChunk[];
      chunksV2: DocumentChunk[];
      knowledgeNodes: KnowledgeNode[];
    };

    const apiKey = process.env.LLM_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error: "LLM_API_KEY not set",
        },
        {
          status: 500,
        }
      );
    }

    console.time("compare-analysis");

    // ─────────────────────────────────────────
    // Structural comparison
    // ─────────────────────────────────────────

    const results = compareClauses(
      chunksV1,
      chunksV2
    );

    // Skip unchanged clauses for expensive AI scoring
    const filteredResults = results.filter(
      (result) =>
        result.match_type !== "UNCHANGED"
    );

    console.log(
      `Comparisons requiring AI scoring: ${filteredResults.length}`
    );

    // ─────────────────────────────────────────
    // Parallel clause scoring
    // ─────────────────────────────────────────

    const enrichedResults =
      await Promise.all(
        filteredResults.map(
          async (
            result
          ): Promise<ComparisonResult> => {
            let score1:
              | number
              | undefined;

            let score2:
              | number
              | undefined;

            let triggeredConstraints: string[] =
              [];

            try {
              // Score OLD clause
              const scoreV1Promise =
                result.chunk_v1
                  ? scoreClause(
                      result.chunk_v1,
                      knowledgeNodes,
                      apiKey
                    )
                  : Promise.resolve(
                      null
                    );

              // Score NEW clause
              const scoreV2Promise =
                result.chunk_v2
                  ? scoreClause(
                      result.chunk_v2,
                      knowledgeNodes,
                      apiKey
                    )
                  : Promise.resolve(
                      null
                    );

              const [s1, s2] =
                await Promise.all([
                  scoreV1Promise,
                  scoreV2Promise,
                ]);

              score1 = s1?.score;
              score2 = s2?.score;

              // ONLY real triggered constraints
              triggeredConstraints = [
                ...(s1?.constraint_violations.map(
                  (v) => v.node_id
                ) || []),

                ...(s2?.constraint_violations.map(
                  (v) => v.node_id
                ) || []),
              ];

              // Deduplicate
              triggeredConstraints = [
                ...new Set(
                  triggeredConstraints
                ),
              ];
            } catch (err) {
              console.error(
                "Scoring skipped for:",
                result.chunk_v2
                  ?.clause_title,
                err
              );
            }

            // ─────────────────────────────────
            // Risk delta stabilization
            // ─────────────────────────────────

            const similarity =
              result.similarity_score || 0;

            let stableScore1 =
              score1 || 0;

            let stableScore2 =
              score2 || 0;

            // Prevent random score swings
            // for nearly identical clauses
            if (similarity > 0.97) {
              stableScore2 =
                stableScore1;
            }

            const deltaValue =
              stableScore2 -
              stableScore1;

            let risk_delta:
              | "INCREASED"
              | "DECREASED"
              | "UNCHANGED" =
              "UNCHANGED";

            if (deltaValue >= 1) {
              risk_delta =
                "INCREASED";
            } else if (
              deltaValue <= -1
            ) {
              risk_delta =
                "DECREASED";
            }

            // ADDED high-risk clause
            if (
              result.match_type ===
                "ADDED" &&
              stableScore2 >= 7
            ) {
              risk_delta =
                "INCREASED";
            }

            // ─────────────────────────────────
            // Change severity classification
            // ─────────────────────────────────

            let change_severity:
              | "LOW"
              | "MEDIUM"
              | "HIGH"
              | "CRITICAL" =
              "LOW";

            if (
              stableScore2 >= 8 ||
              triggeredConstraints.includes(
                "C-010"
              ) ||
              triggeredConstraints.includes(
                "C-013"
              )
            ) {
              change_severity =
                "CRITICAL";
            } else if (
              stableScore2 >= 6
            ) {
              change_severity =
                "HIGH";
            } else if (
              stableScore2 >= 4
            ) {
              change_severity =
                "MEDIUM";
            }

            return {
              ...result,

              score_v1:
                stableScore1,

              score_v2:
                stableScore2,

              risk_delta,

              change_severity,

              triggered_constraints:
                triggeredConstraints,
            };
          }
        )
      );

    // ─────────────────────────────────────────
    // Restore unchanged clauses
    // ─────────────────────────────────────────

    const untouchedResults =
      results
        .filter(
          (r) =>
            r.match_type ===
            "UNCHANGED"
        )
        .map(
          (
            r
          ): ComparisonResult => ({
            ...r,

            risk_delta:
              "UNCHANGED",

            change_severity:
              "LOW",

            triggered_constraints:
              [],
          })
        );

    const finalResults: ComparisonResult[] =
      [
        ...untouchedResults,
        ...enrichedResults,
      ];

    // ─────────────────────────────────────────
    // Weighted net risk scoring
    // ─────────────────────────────────────────

    let weightedRiskDelta = 0;

    finalResults.forEach((result) => {
      const oldScore =
        result.score_v1 || 0;

      const newScore =
        result.score_v2 || 0;

      weightedRiskDelta +=
        calculateWeightedRiskDelta(
          oldScore,
          newScore
        );
    });

    let netRiskStatus:
      | "INCREASED"
      | "DECREASED"
      | "UNCHANGED" =
      "UNCHANGED";

    if (weightedRiskDelta >= 2) {
      netRiskStatus =
        "INCREASED";
    }

    if (weightedRiskDelta <= -2) {
      netRiskStatus =
        "DECREASED";
    }

    console.timeEnd(
      "compare-analysis"
    );

    return NextResponse.json({
      results: finalResults,

      net_risk_delta:
        netRiskStatus,

      weighted_risk_delta:
        weightedRiskDelta,

      summary: {
        total_changes:
          enrichedResults.length,

        critical_changes:
          enrichedResults.filter(
            (r) =>
              r.change_severity ===
              "CRITICAL"
          ).length,

        high_changes:
          enrichedResults.filter(
            (r) =>
              r.change_severity ===
              "HIGH"
          ).length,

        medium_changes:
          enrichedResults.filter(
            (r) =>
              r.change_severity ===
              "MEDIUM"
          ).length,

        increased_risk:
          enrichedResults.filter(
            (r) =>
              r.risk_delta ===
              "INCREASED"
          ).length,

        decreased_risk:
          enrichedResults.filter(
            (r) =>
              r.risk_delta ===
              "DECREASED"
          ).length,
      },
    });
  } catch (err: unknown) {
    console.error(err);

    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : String(err),
      },
      {
        status: 500,
      }
    );
  }
}