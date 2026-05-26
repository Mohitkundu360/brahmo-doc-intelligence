import { DocumentChunk, ClauseType } from "./types";

// ─── Clause boundary patterns ─────────────────────────────────────────────────
// ONLY top-level boundaries — do NOT split sub-clauses like 1.1, 1.2 into separate chunks

const PATTERNS = {
  // Top-level numbered: "1.", "2.", "10." — NOT "1.1" sub-clauses
  topLevel: /^(\d+)\.\s+([A-Z][^\n]{0,80})/,
  // Article: "Article IV", "Article 4"
  article: /^(Article\s+(?:[IVX]+|\d+))\s*[:\-\u2013]?\s*([^\n]{0,80})/i,
  // CLAUSE/SECTION keyword: "CLAUSE 3", "SECTION 5"
  clauseKeyword: /^(CLAUSE|SECTION|PART)\s+(\d+)\s*[:\-\u2013]?\s*([^\n]{0,80})/i,
  // UPPERCASE standalone title (3+ words or 6+ chars, no digits)
  uppercaseTitle: /^([A-Z][A-Z\s\-]{5,60})$/,
  // Schedule/Annexure markers
  schedule: /^(SCHEDULE|ANNEXURE|EXHIBIT|APPENDIX)\s+([A-Z0-9]+)\s*[:\-\u2013]?\s*([^\n]{0,60})/i,
};

// Map keywords → ClauseType
const TYPE_MAP: [RegExp, ClauseType][] = [
  [/defin|interpret|meaning/i, "definition"],
  [/indemnif/i, "indemnity"],
  [/liabilit|limitation|cap/i, "limitation"],
  [/terminat|expir|cessation/i, "termination"],
  [/intellectu|\bip\b|patent|copyright|trademark|proprietary/i, "ip"],
  [/confidential|non.disclos|secret/i, "confidentiality"],
  [/dispute|arbitrat|governing law|jurisdiction|litigation/i, "dispute"],
  [/shall|must|oblig|duty|require/i, "obligation"],
];

function detectClauseType(title: string, text: string): ClauseType {
  const haystack = `${title} ${text.slice(0, 200)}`;
  for (const [pattern, type] of TYPE_MAP) {
    if (pattern.test(haystack)) return type;
  }
  return "general";
}

function isBoundaryLine(line: string): { is: boolean; number: string; title: string } {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 3) return { is: false, number: "", title: "" };

  // Top-level numbered heading ONLY (single number, not 1.1 or 1.1.1)
  const top = trimmed.match(PATTERNS.topLevel);
  if (top) return { is: true, number: top[1], title: top[2].trim() };

  // Article
  const art = trimmed.match(PATTERNS.article);
  if (art) return { is: true, number: art[1], title: art[2].trim() };

  // CLAUSE / SECTION keyword
  const kw = trimmed.match(PATTERNS.clauseKeyword);
  if (kw) return { is: true, number: `${kw[1]} ${kw[2]}`, title: kw[3]?.trim() ?? "" };

  // UPPERCASE title — strict: standalone line, 6-60 chars, no digits
  const up = trimmed.match(PATTERNS.uppercaseTitle);
  if (up && !/\d/.test(trimmed) && trimmed.split(" ").length >= 1) {
    return { is: true, number: "", title: up[1].trim() };
  }

  // Schedule / Annexure
  const sched = trimmed.match(PATTERNS.schedule);
  if (sched) return { is: true, number: `${sched[1]} ${sched[2]}`, title: sched[3]?.trim() ?? "" };

  return { is: false, number: "", title: "" };
}

export function chunkDocument(text: string, documentId?: string): DocumentChunk[] {
  const lines = text.split(/\r?\n/);
  const chunks: DocumentChunk[] = [];

  let currentNumber = "";
  let currentTitle = "";
  let currentLines: string[] = [];
  let chunkIndex = 0;

  function flushChunk() {
    const body = currentLines.join("\n").trim();
    if (!body && !currentTitle) return;
    // Skip noise: very short content with no title
    if (body.length < 20 && !currentTitle) return;

    const fullText = currentTitle
      ? `${currentNumber ? currentNumber + ". " : ""}${currentTitle}\n${body}`
      : body;

    chunks.push({
      id: `chunk_${chunkIndex}`,
      document_id: documentId,
      chunk_index: chunkIndex++,
      clause_number: currentNumber,
      clause_title: currentTitle || `Section ${chunkIndex}`,
      clause_type: detectClauseType(currentTitle, body),
      text: fullText.trim(),
    });
  }

  for (const line of lines) {
    const boundary = isBoundaryLine(line);
    if (boundary.is) {
      flushChunk();
      currentNumber = boundary.number;
      currentTitle = boundary.title;
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  flushChunk();

  return chunks;
}

// ─── Jaccard similarity ───────────────────────────────────────────────────────
export function similarity(a: string, b: string): number {
  const aWords = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
  const bWords = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
  const intersection = [...aWords].filter((w) => bWords.has(w)).length;
  const union = new Set([...aWords, ...bWords]).size;
  return union === 0 ? 0 : intersection / union;
}
