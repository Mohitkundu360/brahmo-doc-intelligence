// src/lib/semantic-match.ts

import { normalizeClauseText } from "./text-normalizer";

export function normalizeText(text: string): string {
  return normalizeClauseText(text)
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(text: string): string[] {
  return normalizeText(text)
    .split(" ")
    .filter(Boolean);
}

function jaccardSimilarity(
  a: string[],
  b: string[]
): number {
  const setA = new Set(a);
  const setB = new Set(b);

  const intersection = [...setA].filter((x) =>
    setB.has(x)
  ).length;

  const union = new Set([
    ...setA,
    ...setB,
  ]).size;

  if (union === 0) return 0;

  return intersection / union;
}

function containmentSimilarity(
  a: string[],
  b: string[]
): number {
  const setA = new Set(a);
  const setB = new Set(b);

  const intersection = [...setA].filter((x) =>
    setB.has(x)
  ).length;

  return (
    intersection /
    Math.min(setA.size || 1, setB.size || 1)
  );
}

function keywordBoost(
  a: string,
  b: string
): number {
  const importantTerms = [
    "liability",
    "indemnity",
    "termination",
    "confidentiality",
    "non-compete",
    "non-solicitation",
    "arbitration",
    "jurisdiction",
    "intellectual property",
    "remote work",
  ];

  let score = 0;

  const normalizedA =
    normalizeClauseText(a);

  const normalizedB =
    normalizeClauseText(b);

  for (const term of importantTerms) {
    const inA =
      normalizedA.includes(term);

    const inB =
      normalizedB.includes(term);

    if (inA && inB) {
      score += 1;
    }
  }

  return importantTerms.length
    ? score / importantTerms.length
    : 0;
}

function titleSimilarity(
  a: string,
  b: string
): number {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);

  return jaccardSimilarity(
    tokensA,
    tokensB
  );
}

export function calculateSimilarity(
  a: string,
  b: string,
  titleA = "",
  titleB = ""
): number {
  // NORMALIZED TEXT
  const textA =
    normalizeClauseText(a);

  const textB =
    normalizeClauseText(b);

  const tokensA = tokenize(textA);

  const tokensB = tokenize(textB);

  const jaccard =
    jaccardSimilarity(
      tokensA,
      tokensB
    );

  const containment =
    containmentSimilarity(
      tokensA,
      tokensB
    );

  const keyword =
    keywordBoost(textA, textB);

  const titleScore =
    titleSimilarity(
      titleA,
      titleB
    );

  const finalScore =
    jaccard * 0.4 +
    containment * 0.3 +
    keyword * 0.2 +
    titleScore * 0.1;

  return Math.min(finalScore, 1);
}

export function isSemanticMatch(
  a: string,
  b: string,
  titleA = "",
  titleB = "",
  threshold = 0.68
): boolean {
  return (
    calculateSimilarity(
      a,
      b,
      titleA,
      titleB
    ) >= threshold
  );
}