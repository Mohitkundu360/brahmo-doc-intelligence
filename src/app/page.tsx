"use client";

import { useState, useCallback } from "react";
import { DocumentChunk, RiskScore, ComparisonResult, KnowledgeNode } from "@/lib/types";

// ─── Seed knowledge nodes (inline for demo — normally from Supabase) ───────────
const KNOWLEDGE_NODES: KnowledgeNode[] = [
  { id: "C-010", node_type: "CONSTRAINT", title: "Liability Cap", practice_area: "corporate", tags: ["contract", "liability"], content: "Firm policy: liability in any contract must be capped at maximum 2x the annual contract value. Uncapped liability = automatic HIGH risk flag." },
  { id: "C-011", node_type: "CONSTRAINT", title: "Non-Compete Duration", practice_area: "corporate", tags: ["contract", "non_compete"], content: "Firm policy: non-compete and non-solicitation clauses must not exceed 12 months. Any duration > 12 months must be rejected or negotiated down." },
  { id: "C-012", node_type: "CONSTRAINT", title: "IP Carve-Out", practice_area: "corporate", tags: ["contract", "ip"], content: "Firm policy: IP assignment clauses must include carve-out for pre-existing IP. Broad 'all IP' assignments without carve-out = HIGH risk." },
  { id: "C-013", node_type: "CONSTRAINT", title: "Arbitration Preference", practice_area: "corporate", tags: ["contract", "dispute"], content: "Firm policy: arbitration (SIAC or LCIA rules) preferred over litigation for cross-border contracts. Removal of arbitration clause = flag for review." },
  { id: "C-014", node_type: "CONSTRAINT", title: "Termination Notice", practice_area: "corporate", tags: ["contract", "termination"], content: "Firm policy: termination for convenience must have minimum 90 days notice. Shorter notice periods disadvantage our clients." },
  { id: "AP-010", node_type: "ANTI_PATTERN", title: "One-sided Indemnification", practice_area: "corporate", tags: ["contract", "indemnity"], content: "Don't accept one-sided indemnification in vendor contracts. Past case: client liable for vendor's data breach because indemnity was one-way. Always insist on mutual indemnification." },
  { id: "AP-011", node_type: "ANTI_PATTERN", title: "Auto-renewal Short Opt-out", practice_area: "corporate", tags: ["contract", "auto_renewal"], content: "Watch for auto-renewal clauses with short opt-out windows. Past case: client locked into 3-year renewal because opt-out was 30 days. Flag any opt-out < 90 days." },
  { id: "D-010", node_type: "DECISION", title: "Return of Materials Mandatory", practice_area: "corporate", tags: ["nda", "materials"], content: "TechCorp NDA (2026): Client lost trade secret protection because NDA had no 'return of materials' clause. Now MANDATORY: every NDA must include return/destruction of confidential materials on termination." },
  { id: "D-011", node_type: "DECISION", title: "Proportionate Liquidated Damages", practice_area: "corporate", tags: ["contract", "penalty"], content: "Sharma Services Agreement (2025): Liquidated damages clause struck down as 'penalty' because amount was disproportionate (10x breach value). Lesson: keep LD clauses proportionate to actual estimated loss." },
  { id: "D-012", node_type: "DECISION", title: "Clear Dispute Resolution", practice_area: "corporate", tags: ["contract", "jurisdiction"], content: "ABC Cross-Border (2026): Won jurisdiction challenge because contract specified SIAC Singapore. Opponent tried Indian courts — dismissed. Lesson: clear dispute resolution clause saves months of fighting." },
];

type Mode = "single" | "compare";

interface DocState {
  filename: string;
  chunks: DocumentChunk[];
  scores: RiskScore[];
  summary: { total: number; high: number; medium: number; low: number };
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("single");
  const [doc1, setDoc1] = useState<DocState | null>(null);
  const [doc2, setDoc2] = useState<DocState | null>(null);
  const [comparison, setComparison] = useState<{
    results: ComparisonResult[];
    net_risk_delta: string;
    triggeredConstraints: KnowledgeNode[];
  } | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uploadAndScore = useCallback(async (file: File): Promise<DocState> => {
    // 1. Extract + chunk
    const form = new FormData();
    form.append("file", file);
    const upRes = await fetch("/api/upload", { method: "POST", body: form });
    if (!upRes.ok) throw new Error(await upRes.text());
    const upData = await upRes.json();

    // 2. Score
    const scoreRes = await fetch("/api/score-risk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chunks: upData.chunks, knowledgeNodes: KNOWLEDGE_NODES }),
    });
    if (!scoreRes.ok) throw new Error(await scoreRes.text());
    const scoreData = await scoreRes.json();

    return {
      filename: file.name,
      chunks: upData.chunks,
      scores: scoreData.scores,
      summary: scoreData.summary,
    };
  }, []);

  const handleFileUpload = async (file: File, slot: 1 | 2) => {
    setError(null);
    setLoading(slot === 1 ? "Extracting & scoring document 1…" : "Extracting & scoring document 2…");
    try {
      const result = await uploadAndScore(file);
      if (slot === 1) setDoc1(result);
      else setDoc2(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(null);
    }
  };

  const handleCompare = async () => {
    if (!doc1 || !doc2) return;
    setLoading("Comparing clauses…");
    setError(null);
    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chunksV1: doc1.chunks,
          chunksV2: doc2.chunks,
          knowledgeNodes: KNOWLEDGE_NODES,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setComparison(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(null);
    }
  };

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-[#e8e6e0] font-mono">
      {/* Header */}
      <header className="border-b border-[#1e1e2a] px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-[#c8a96e] rounded-sm flex items-center justify-center text-black font-bold text-sm">B</div>
          <span className="text-[#c8a96e] font-bold tracking-widest text-sm uppercase">BRAHMO</span>
          <span className="text-[#3a3a4a] mx-2">|</span>
          <span className="text-[#888] text-xs tracking-wider">Document Intelligence</span>
        </div>
        <div className="flex gap-1 bg-[#12121a] border border-[#1e1e2a] rounded p-1">
          {(["single", "compare"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setComparison(null); }}
              className={`px-4 py-1.5 text-xs tracking-wider rounded transition-all ${
                mode === m
                  ? "bg-[#c8a96e] text-black font-bold"
                  : "text-[#666] hover:text-[#999]"
              }`}
            >
              {m === "single" ? "RISK SCAN" : "COMPARE"}
            </button>
          ))}
        </div>
      </header>

      <div className="px-8 py-6 max-w-[1400px] mx-auto">
        {/* Upload Zone */}
        <div className={`grid gap-4 mb-6 ${mode === "compare" ? "grid-cols-2" : "grid-cols-1 max-w-xl"}`}>
          <UploadZone
            label={mode === "compare" ? "Contract v1" : "Upload Contract"}
            doc={doc1}
            onFile={(f) => handleFileUpload(f, 1)}
          />
          {mode === "compare" && (
            <UploadZone
              label="Contract v2 (Revised)"
              doc={doc2}
              onFile={(f) => handleFileUpload(f, 2)}
            />
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-950/40 border border-red-900/60 text-red-400 text-xs rounded">
            ⚠ {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="mb-4 p-3 bg-[#c8a96e]/10 border border-[#c8a96e]/30 text-[#c8a96e] text-xs rounded flex items-center gap-2">
            <span className="animate-spin">⟳</span> {loading}
          </div>
        )}

        {/* Compare button */}
        {mode === "compare" && doc1 && doc2 && !loading && (
          <button
            onClick={handleCompare}
            className="mb-6 px-6 py-2 bg-[#c8a96e] text-black font-bold text-xs tracking-widest rounded hover:bg-[#d4b87a] transition-all"
          >
            RUN COMPARISON →
          </button>
        )}

        {/* Single doc results */}
        {mode === "single" && doc1 && (
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2">
              <SummaryBar summary={doc1.summary} />
              <div className="mt-4 space-y-2">
                {doc1.chunks.map((chunk, i) => {
                  const score = doc1.scores[i];
                  return score ? (
                    <ClauseCard key={i} chunk={chunk} score={score} />
                  ) : null;
                })}
              </div>
            </div>
            <KnowledgePanel nodes={KNOWLEDGE_NODES} />
          </div>
        )}

        {/* Comparison results */}
        {mode === "compare" && comparison && (
          <ComparisonView
            results={comparison.results}
            netDelta={comparison.net_risk_delta}
            triggeredConstraints={comparison.triggeredConstraints}
          />
        )}
      </div>
    </main>
  );
}

// ─── Components ───────────────────────────────────────────────────────────────

function UploadZone({
  label,
  doc,
  onFile,
}: {
  label: string;
  doc: DocState | null;
  onFile: (f: File) => void;
}) {
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const f = e.dataTransfer.files[0];
      if (f) onFile(f);
    },
    [onFile]
  );

  return (
    <div
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
      className="border border-dashed border-[#2a2a3a] rounded-lg p-6 text-center hover:border-[#c8a96e]/50 transition-all cursor-pointer bg-[#0d0d15]"
      onClick={() => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".docx,.pdf";
        input.onchange = (e) => {
          const f = (e.target as HTMLInputElement).files?.[0];
          if (f) onFile(f);
        };
        input.click();
      }}
    >
      {doc ? (
        <div className="text-left">
          <div className="text-[#c8a96e] text-xs font-bold mb-1">{label}</div>
          <div className="text-sm text-white">{doc.filename}</div>
          <div className="text-xs text-[#666] mt-1">{doc.chunks.length} clauses extracted</div>
        </div>
      ) : (
        <div>
          <div className="text-2xl mb-2">📄</div>
          <div className="text-[#c8a96e] text-xs font-bold mb-1">{label}</div>
          <div className="text-[#555] text-xs">Drop DOCX or PDF here, or click</div>
        </div>
      )}
    </div>
  );
}

function SummaryBar({ summary }: { summary: DocState["summary"] }) {
  return (
    <div className="flex gap-3">
      {[
        { label: "HIGH", count: summary.high, color: "text-red-400 border-red-900/50 bg-red-950/30" },
        { label: "MEDIUM", count: summary.medium, color: "text-yellow-400 border-yellow-900/50 bg-yellow-950/30" },
        { label: "LOW", count: summary.low, color: "text-green-400 border-green-900/50 bg-green-950/30" },
      ].map(({ label, count, color }) => (
        <div key={label} className={`border px-4 py-2 rounded text-xs font-bold ${color}`}>
          {count} {label}
        </div>
      ))}
      <div className="border border-[#2a2a3a] px-4 py-2 rounded text-xs text-[#666]">
        {summary.total} TOTAL
      </div>
    </div>
  );
}

function ClauseCard({ chunk, score }: { chunk: DocumentChunk; score: RiskScore }) {
  const [open, setOpen] = useState(false);

  const indicator =
    score.risk_level === "HIGH"
      ? { icon: "🔴", border: "border-red-900/50", bg: "bg-red-950/20", badge: "text-red-400" }
      : score.risk_level === "MEDIUM"
      ? { icon: "🟡", border: "border-yellow-900/50", bg: "bg-yellow-950/20", badge: "text-yellow-400" }
      : { icon: "🟢", border: "border-green-900/50", bg: "bg-green-950/10", badge: "text-green-400" };

  return (
    <div className={`border ${indicator.border} ${indicator.bg} rounded p-3 cursor-pointer`} onClick={() => setOpen(!open)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span>{indicator.icon}</span>
          <span className="text-xs font-bold text-white">
            {chunk.clause_number && <span className="text-[#c8a96e] mr-1">{chunk.clause_number}.</span>}
            {chunk.clause_title}
          </span>
          <span className="text-[10px] text-[#555] uppercase">{chunk.clause_type}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold ${indicator.badge}`}>{score.score}/10</span>
          <span className="text-[#444] text-xs">{open ? "▲" : "▼"}</span>
        </div>
      </div>

      {open && (
        <div className="mt-3 border-t border-[#1e1e2a] pt-3 space-y-2">
          <div className="text-[11px] text-[#888] leading-relaxed">{chunk.text.slice(0, 400)}{chunk.text.length > 400 ? "…" : ""}</div>
          {score.risk_factors.length > 0 && (
            <div>
              <div className="text-[10px] text-[#c8a96e] font-bold mb-1">RISK FACTORS</div>
              {score.risk_factors.map((f, i) => (
                <div key={i} className="text-[11px] text-[#aaa]">• {f}</div>
              ))}
            </div>
          )}
          {score.constraint_violations.length > 0 && (
            <div>
              <div className="text-[10px] text-[#c8a96e] font-bold mb-1">CONSTRAINT VIOLATIONS</div>
              {score.constraint_violations.map((v, i) => (
                <div key={i} className="text-[11px] text-red-400">⚠ [{v.node_id}] {v.node_title}: {v.reason}</div>
              ))}
            </div>
          )}
          <div className="text-[11px] text-[#c8a96e] mt-1">→ {score.recommendation}</div>
        </div>
      )}
    </div>
  );
}

function ComparisonView({
  results,
  netDelta,
  triggeredConstraints,
}: {
  results: ComparisonResult[];
  netDelta: string;
  triggeredConstraints: KnowledgeNode[];
}) {
  const modified = results.filter((r) => r.match_type !== "UNCHANGED");
  const unchanged = results.filter((r) => r.match_type === "UNCHANGED");

  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="col-span-2 space-y-4">
        {/* Net delta banner */}
        <div
          className={`p-3 rounded border text-sm font-bold flex items-center gap-2 ${
            netDelta === "INCREASED"
              ? "bg-red-950/40 border-red-900/50 text-red-400"
              : netDelta === "DECREASED"
              ? "bg-green-950/40 border-green-900/50 text-green-400"
              : "bg-[#1a1a25] border-[#2a2a3a] text-[#888]"
          }`}
        >
          {netDelta === "INCREASED" ? "⬆" : netDelta === "DECREASED" ? "⬇" : "→"} NET RISK {netDelta}
        </div>

        {/* Changed clauses */}
        {modified.map((r, i) => (
          <ComparisonRow key={i} result={r} />
        ))}

        {/* Unchanged (collapsed) */}
        {unchanged.length > 0 && (
          <div className="border border-[#1e1e2a] rounded p-3 text-xs text-[#555]">
            {unchanged.length} clauses unchanged
          </div>
        )}
      </div>

      <KnowledgePanel
  nodes={
    triggeredConstraints?.length > 0
      ? triggeredConstraints
      : KNOWLEDGE_NODES
  }
/>
    </div>
  );
}

function ComparisonRow({ result }: { result: ComparisonResult }) {
  const [open, setOpen] = useState(result.match_type !== "UNCHANGED");

  const configMap: Record<
    string,
    {
      label: string;
      border: string;
      bg: string;
      badge: string;
    }
  > = {
    MODIFIED: {
      label: "MODIFIED",
      border: "border-yellow-900/50",
      bg: "bg-yellow-950/10",
      badge: "text-yellow-400 bg-yellow-950/50",
    },

    ADDED: {
      label: "ADDED",
      border: "border-green-900/50",
      bg: "bg-green-950/10",
      badge: "text-green-400 bg-green-950/50",
    },

    REMOVED: {
      label: "REMOVED",
      border: "border-red-900/50",
      bg: "bg-red-950/10",
      badge: "text-red-400 bg-red-950/50",
    },

    RESTRUCTURED: {
      label: "RESTRUCTURED",
      border: "border-blue-900/50",
      bg: "bg-blue-950/10",
      badge: "text-blue-400 bg-blue-950/50",
    },

    UNCHANGED: {
      label: "UNCHANGED",
      border: "border-[#1e1e2a]",
      bg: "bg-[#0d0d15]",
      badge: "text-[#555] bg-[#1a1a25]",
    },
  };

  const config =
    configMap[result.match_type] || configMap["UNCHANGED"];

  const chunk = result.chunk_v2 ?? result.chunk_v1;

  const title = `${
    chunk?.clause_number ? chunk.clause_number + ". " : ""
  }${chunk?.clause_title ?? ""}`;

  const deltaIcon =
    result.risk_delta === "INCREASED"
      ? "⬆ risk"
      : result.risk_delta === "DECREASED"
      ? "⬇ risk"
      : "";

  return (
    <div className={`border ${config.border} ${config.bg} rounded`}>
      <div
        className="p-3 flex items-center justify-between cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded ${config.badge}`}
          >
            {config.label}
          </span>

          <span className="text-xs text-white font-medium">
            {title}
          </span>

          {deltaIcon && (
            <span
              className={`text-[10px] ${
                result.risk_delta === "INCREASED"
                  ? "text-red-400"
                  : "text-green-400"
              }`}
            >
              {deltaIcon}
            </span>
          )}
        </div>

        <span className="text-[#444] text-xs">
          {open ? "▲" : "▼"}
        </span>
      </div>

      {open && (
        <div className="border-t border-[#1e1e2a] p-3">
          {result.match_type === "MODIFIED" &&
          result.diff_text ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] text-[#666] mb-1">
                  VERSION 1
                </div>

                <div className="text-[11px] text-[#888] leading-relaxed">
                  {result.chunk_v1?.text.slice(0, 300)}
                </div>
              </div>

              <div>
                <div className="text-[10px] text-[#666] mb-1">
                  VERSION 2 (changes highlighted)
                </div>

                <div
                  className="text-[11px] leading-relaxed diff-view"
                  dangerouslySetInnerHTML={{
                    __html: result.diff_text.slice(0, 2000),
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-[#888] leading-relaxed">
              {chunk?.text.slice(0, 400)}
            </div>
          )}

          {result.score_v1 !== undefined &&
            result.score_v2 !== undefined && (
              <div className="mt-2 text-[10px] text-[#666]">
                Risk score: {result.score_v1}/10 →{" "}
                {result.score_v2}/10
              </div>
            )}
        </div>
      )}
    </div>
  );
}

function KnowledgePanel({ nodes }: { nodes: KnowledgeNode[] }) {
  return (
    <div className="bg-[#0d0d15] border border-[#1e1e2a] rounded-lg p-4">
      <div className="text-[10px] text-[#c8a96e] font-bold tracking-widest mb-3">FIRM KNOWLEDGE</div>
      <div className="space-y-3">
        {nodes.map((n) => (
          <div key={n.id} className="border-l-2 border-[#c8a96e]/30 pl-3">
            <div className="flex items-center gap-1 mb-0.5">
              <span className="text-[10px] font-bold text-[#c8a96e]">{n.id}</span>
              <span className="text-[9px] text-[#555] uppercase">{n.node_type}</span>
            </div>
            <div className="text-[11px] text-[#666] leading-relaxed">{n.content.slice(0, 120)}…</div>
          </div>
        ))}
      </div>
    </div>
  );
}
