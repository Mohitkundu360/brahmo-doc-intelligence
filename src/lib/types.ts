// src/lib/types.ts

export type ClauseType =
  | "definition"
  | "obligation"
  | "limitation"
  | "termination"
  | "indemnity"
  | "ip"
  | "confidentiality"
  | "dispute"
  | "general";

export interface DocumentChunk {
  [x: string]: any;

  id?: string;

  document_id?: string;

  chunk_index: number;

  clause_number: string;

  clause_title: string;

  clause_type: ClauseType;

  text: string;
}

export interface KnowledgeNode {
  id: string;

  node_type:
    | "CONSTRAINT"
    | "ANTI_PATTERN"
    | "DECISION";

  title: string;

  practice_area: string;

  tags: string[];

  content: string;
}

export interface ConstraintViolation {
  node_id: string;

  node_title: string;

  reason: string;
}

export interface RiskScore {
  chunk_id: string;

  score: number;

  risk_level:
    | "LOW"
    | "MEDIUM"
    | "HIGH";

  risk_factors: string[];

  constraint_violations: ConstraintViolation[];

  recommendation: string;
}

export type MatchType =
  | "UNCHANGED"
  | "MODIFIED"
  | "ADDED"
  | "REMOVED"
  | "RESTRUCTURED"
  | "SPLIT";

export interface ComparisonResult {
  match_type: MatchType;

  chunk_v1?: DocumentChunk;

  chunk_v2?: DocumentChunk;

  similarity_score?: number;

  diff_text?: string;

  score_v1?: number;

  score_v2?: number;

  risk_delta?:
    | "INCREASED"
    | "DECREASED"
    | "UNCHANGED";

  // NEW
  change_severity?:
    | "LOW"
    | "MEDIUM"
    | "HIGH"
    | "CRITICAL";

  // NEW
  triggered_constraints?: string[];
}

export interface DocumentAnalysis {
  document_id: string;

  filename: string;

  chunks: DocumentChunk[];

  risk_scores: RiskScore[];

  summary: {
    total: number;

    high: number;

    medium: number;

    low: number;
  };
}

export interface ComparisonAnalysis {
  doc_v1: DocumentAnalysis;

  doc_v2: DocumentAnalysis;

  results: ComparisonResult[];

  net_risk_delta:
    | "INCREASED"
    | "DECREASED"
    | "UNCHANGED";

  triggered_constraints: KnowledgeNode[];
}