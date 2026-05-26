// src/lib/clause-comparator.ts

import {
  DocumentChunk,
  ComparisonResult,
  MatchType,
} from "./types";

import { calculateSimilarity } from "./semantic-match";

import * as Diff from "diff";

const UNCHANGED_THRESHOLD = 0.92;

const MODIFIED_THRESHOLD = 0.45;

const SEMANTIC_THRESHOLD = 0.30;

export function compareClauses(
  v1Chunks: DocumentChunk[],
  v2Chunks: DocumentChunk[]
): ComparisonResult[] {
  const results: ComparisonResult[] = [];

  const matchedV2Indices =
    new Set<number>();

  for (const chunk1 of v1Chunks) {
    let matchIdx = findByHeading(
      chunk1,
      v2Chunks,
      matchedV2Indices
    );

    // Semantic fallback
    if (matchIdx === -1) {
      matchIdx = findBySemantic(
        chunk1,
        v2Chunks,
        matchedV2Indices
      );
    }

    // Removed clause
    if (matchIdx === -1) {
      results.push({
        match_type: "REMOVED",
        chunk_v1: chunk1,
      });

      continue;
    }

    const chunk2 =
      v2Chunks[matchIdx];

    matchedV2Indices.add(
      matchIdx
    );

    const sim =
      calculateSimilarity(
        chunk1.text,
        chunk2.text,
        chunk1.clause_title,
        chunk2.clause_title
      );

    // ─────────────────────────────
    // Prevent fake MODIFIED matches
    // caused by formatting noise
    // ─────────────────────────────

    const normalized1 =
      chunk1.text
        .replace(/\s+/g, " ")
        .trim();

    const normalized2 =
      chunk2.text
        .replace(/\s+/g, " ")
        .trim();

    const exactNormalizedMatch =
      normalized1 === normalized2;

    // ─────────────────────────────
    // UNCHANGED
    // ─────────────────────────────

    if (
      sim >=
        UNCHANGED_THRESHOLD ||
      exactNormalizedMatch
    ) {
      results.push({
        match_type: "UNCHANGED",
        chunk_v1: chunk1,
        chunk_v2: chunk2,
        similarity_score: sim,
      });
    }

    // ─────────────────────────────
    // MODIFIED / SPLIT
    // ─────────────────────────────

    else if (
      sim >= MODIFIED_THRESHOLD
    ) {
      const secondaryMatches =
        v2Chunks.filter(
          (candidate, idx) => {
            if (
              matchedV2Indices.has(
                idx
              )
            ) {
              return false;
            }

            const score =
              calculateSimilarity(
                chunk1.text,
                candidate.text,
                chunk1.clause_title,
                candidate.clause_title
              );

            return (
              score >=
              SEMANTIC_THRESHOLD
            );
          }
        );

      const isSplit =
        secondaryMatches.length >=
        2;

      results.push({
        match_type: isSplit
          ? "SPLIT"
          : "MODIFIED",

        chunk_v1: chunk1,

        chunk_v2: chunk2,

        similarity_score: sim,

        diff_text: generateDiff(
          chunk1.text,
          chunk2.text
        ),
      });
    }

    // ─────────────────────────────
    // REMOVED
    // ─────────────────────────────

    else {
      results.push({
        match_type: "REMOVED",
        chunk_v1: chunk1,
      });
    }
  }

  // ─────────────────────────────
  // ADDED clauses
  // ─────────────────────────────

  for (
    let i = 0;
    i < v2Chunks.length;
    i++
  ) {
    if (
      !matchedV2Indices.has(i)
    ) {
      results.push({
        match_type: "ADDED",
        chunk_v2: v2Chunks[i],
      });
    }
  }

  // ─────────────────────────────
  // Sort order
  // ─────────────────────────────

  const order: Record<
    MatchType,
    number
  > = {
    SPLIT: 0,
    RESTRUCTURED: 1,
    MODIFIED: 2,
    ADDED: 3,
    REMOVED: 4,
    UNCHANGED: 5,
  };

  results.sort(
    (a, b) =>
      order[a.match_type] -
      order[b.match_type]
  );

  return results;
}

// ─────────────────────────────────
// Heading match
// ─────────────────────────────────

function findByHeading(
  chunk: DocumentChunk,
  pool: DocumentChunk[],
  used: Set<number>
): number {
  if (
    !chunk.clause_number &&
    !chunk.clause_title
  ) {
    return -1;
  }

  for (
    let i = 0;
    i < pool.length;
    i++
  ) {
    if (used.has(i)) continue;

    const c2 = pool[i];

    // Exact clause number
    if (
      chunk.clause_number &&
      c2.clause_number &&
      chunk.clause_number.trim() ===
        c2.clause_number.trim()
    ) {
      return i;
    }

    // Exact title
    if (
      chunk.clause_title &&
      c2.clause_title &&
      chunk.clause_title
        .toLowerCase()
        .trim() ===
        c2.clause_title
          .toLowerCase()
          .trim()
    ) {
      return i;
    }

    // Renumbered title support
    const titleOnlyMatch =
      chunk.clause_title &&
      c2.clause_title &&
      chunk.clause_title
        .replace(
          /^\d+\.?\s*/,
          ""
        )
        .toLowerCase()
        .trim() ===
        c2.clause_title
          .replace(
            /^\d+\.?\s*/,
            ""
          )
          .toLowerCase()
          .trim();

    if (titleOnlyMatch) {
      return i;
    }
  }

  return -1;
}

// ─────────────────────────────────
// Semantic fallback
// ─────────────────────────────────

function findBySemantic(
  chunk: DocumentChunk,
  pool: DocumentChunk[],
  used: Set<number>
): number {
  let bestIdx = -1;

  let bestSim = 0.35;

  const secondaryMatches:
    number[] = [];

  for (
    let i = 0;
    i < pool.length;
    i++
  ) {
    if (used.has(i)) continue;

    const candidate = pool[i];

    const sim =
      calculateSimilarity(
        chunk.text,
        candidate.text,
        chunk.clause_title,
        candidate.clause_title
      );

    if (
      sim >=
      SEMANTIC_THRESHOLD
    ) {
      secondaryMatches.push(i);
    }

    if (sim > bestSim) {
      bestSim = sim;
      bestIdx = i;
    }
  }

  if (
    secondaryMatches.length >=
    2
  ) {
    return secondaryMatches[0];
  }

  return bestIdx;
}

// ─────────────────────────────────
// Word diff generator
// ─────────────────────────────────

export function generateDiff(
  text1: string,
  text2: string
): string {
  const diffs =
    Diff.diffWords(
      text1,
      text2
    );

  let html = "";

  for (const part of diffs) {
    const escaped =
      escapeHtml(part.value);

    if (part.added) {
      html += `<ins>${escaped}</ins>`;
    } else if (
      part.removed
    ) {
      html += `<del>${escaped}</del>`;
    } else {
      html += escaped;
    }
  }

  return html;
}

function escapeHtml(
  str: string
): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}