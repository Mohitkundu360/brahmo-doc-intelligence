# Architecture: BRAHMO Document Intelligence

## Overview

A legal contract analysis system that extracts, compares, and scores clauses using AI + firm-specific knowledge nodes.

```
DOCX/PDF Upload
  → Document Processor (extract text)
  → Legal-Aware Chunker (clause boundary detection)
  → Risk Scorer (LLM + CONSTRAINT nodes)
  → [optional] Clause Comparator (v1 vs v2)
  → Frontend (heatmap / side-by-side diff)
```

---

## 1. Document Processor (`src/lib/document-processor.ts`)

- **DOCX**: `mammoth.extractRawText()` → preserves heading structure
- **PDF**: `pdf-parse` → strips page numbers, standalone short lines (headers/footers)
- Output: clean plain text with newlines preserved for heading detection

---

## 2. Legal-Aware Chunker (`src/lib/legal-chunker.ts`)

### Clause Boundary Detection

Priority order (first match wins per line):

| Priority | Pattern | Example |
|---|---|---|
| 1 | Numbered heading | `1.`, `1.1`, `2.3.4` |
| 2 | Article keyword | `Article IV`, `Article 3` |
| 3 | Clause/Section keyword | `CLAUSE 3`, `SECTION 5` |
| 4 | UPPERCASE standalone title | `CONFIDENTIALITY`, `INDEMNIFICATION` |
| 5 | Schedule/Annexure | `SCHEDULE A`, `ANNEXURE 1` |

**Key rules:**
- Never split inside a sub-clause — deep sub-clauses (3+ levels, <200 chars) are merged into parent
- Each chunk tagged: `clause_number`, `clause_title`, `clause_type`
- Clause type detected by keyword matching on title + first 200 chars of text

### Why not AI for chunking?

Regex is deterministic, fast, and handles 200+ documents without rate limits. At 200 contracts, AI chunking would cost ~$40 and take 30 minutes. Regex takes <1 second and $0.

---

## 3. Clause Comparator (`src/lib/clause-comparator.ts`)

### Two-level matching

**Level 1 — Heading match:**
- Match by exact `clause_number` (e.g. `5.2` ↔ `5.2`)
- OR exact `clause_title` (case-insensitive)

**Level 2 — Semantic match (Jaccard similarity):**
- For clauses with no heading match (restructured, renumbered)
- Tokenize both texts → compute word set intersection/union
- Threshold: 0.40 similarity (below = different clause)
- This catches the SPA split scenario: Clause 8 content distributes across 8 + 8A

**Classification:**
- `>= 0.95` similarity → UNCHANGED
- `0.40–0.95` similarity + matched → MODIFIED
- No match found in v2 → REMOVED
- No match found in v1 → ADDED

**Word-level diff:** `diff` library → `diffWords()` → HTML `<del>` / `<ins>` tags

---

## 4. Risk Scorer (`src/lib/risk-scorer.ts`)

### Prompt design

Each clause scored by sending to Claude Sonnet with:
1. All 10 firm knowledge nodes (CONSTRAINT / ANTI_PATTERN / DECISION)
2. Risk rubric (score impact per factor)
3. Clause text

**Critical:** Prompt instructs model that CONSTRAINT nodes **override** generic scoring. Example: if C-010 says uncapped liability = HIGH, the score must be >= 7 regardless of other factors.

### Risk delta (comparison mode)

For each MODIFIED / ADDED / REMOVED clause:
- Score both versions
- `risk_delta = v2_score > v1_score + 0.5 → INCREASED` (etc.)
- Net delta = sum of all deltas across document

### Score ranges

| Score | Level | Color |
|---|---|---|
| 1–3 | LOW | Green |
| 4–6 | MEDIUM | Orange |
| 7–10 | HIGH | Red |

---

## 5. Surprise Contract Handling

The chunker is contract-type agnostic — it detects clause boundaries by **structure** (numbering, capitalisation, keywords), not by clause title.

A commercial lease with "CLAUSE 5: RENT ESCALATION" is chunked identically to an NDA with "CLAUSE 5: CONFIDENTIALITY". The risk scorer applies the same CONSTRAINT nodes to any clause text.

**Scalability to 200 documents:**
```
Parallel batch processing (5 concurrent)
  → Same chunker, scorer, comparator
  → Aggregate risk matrix across all documents
  → Zero code changes — just a batch wrapper
```

---

## Database

| Table | Purpose |
|---|---|
| `knowledge_nodes` | 10 firm rules (seed.sql) |
| `documents` | Uploaded contract metadata |
| `document_chunks` | Extracted clauses per document |
| `risk_scores` | Per-clause risk analysis |
| `comparison_results` | v1↔v2 matching results |

---

## Known Test Cases → Expected Output

| Scenario | Expected |
|---|---|
| NDA v1 vs v2 | 4 changes: 5.2 MODIFIED, 8 MODIFIED, 11A ADDED, 12 MODIFIED |
| 11A (24 months) | C-011 triggered: "max 12 months" |
| Clause 12 (arbitration removed) | C-013 triggered: "arbitration preferred" |
| SPA Clause 8 split | Semantic match catches — not reported as DELETE+ADD |
| Employment non-compete 18mo | C-011 triggered |
| Termination 30d | C-014 triggered |
