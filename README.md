# BRAHMO — Document Intelligence

Legal contract comparison and risk scoring system. Upload two contract versions → instant clause-by-clause comparison with AI risk analysis powered by firm-specific knowledge nodes.

## Features

- **Legal-aware chunking** — clause boundary detection (not generic text splitting)
- **Two-mode comparison** — UNCHANGED / MODIFIED / ADDED / REMOVED with word-level diffs
- **Firm knowledge injection** — CONSTRAINT nodes override generic scoring
- **Risk heatmap** — red/orange/green per clause (1–10 score)
- **Risk delta** — net INCREASED / DECREASED after comparison
- **Universal** — works on any contract type (NDA, SPA, employment, lease, etc.)

## Setup

### 1. Clone and install

```bash
git clone <your-repo>
cd brahmo-doc-intelligence
npm install
```

### 2. Supabase

1. Create free project at [supabase.com](https://supabase.com)
2. SQL Editor → paste and run `supabase/schema.sql`
3. SQL Editor → paste and run `supabase/seed.sql`
4. Settings → API → copy Project URL + anon key

### 3. Environment

```bash
cp .env.local.example .env.local
# Fill in your Supabase URL, anon key, and LLM API key
```

`.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
LLM_API_KEY=sk-ant-...   # Anthropic, OpenAI, or Gemini key
```

Free API options: [console.anthropic.com](https://console.anthropic.com) | [platform.openai.com](https://platform.openai.com)

### 4. Run

```bash
npm run dev
# → http://localhost:3000
```

## Test Documents

`test-documents/` contains sample NDA v1 and v2 with 4 documented changes:

| Clause | Change | Triggers |
|---|---|---|
| 5.2 Liability | unlimited → 2x cap | risk ↓ |
| 8 Term | 3yr → 5yr | risk ↑ |
| 11A Non-solicitation | ADDED (24 months) | C-011 violation |
| 12 Dispute Resolution | arbitration → Delhi courts | C-013 violation |

> Note: test files are `.txt` — rename to `.docx` or convert for full demo.
> Use any AI tool to generate properly formatted DOCX contracts based on these.

## Usage

**Mode A — Risk Scan:** Upload one contract → view clause heatmap + constraint violations

**Mode B — Compare:** Upload v1 + v2 → click "RUN COMPARISON" → side-by-side diffs + net risk delta

## Architecture

See `docs/architecture.md` for detailed explanation of:
- Chunking algorithm and clause boundary detection
- Two-level matching strategy (heading + semantic)
- Risk scoring prompt design and CONSTRAINT injection
- Scalability approach (200+ documents)

## Stack

- Next.js 14 + TypeScript + Tailwind CSS
- Supabase (PostgreSQL)
- Claude Sonnet (risk scoring)
- mammoth (DOCX extraction) + pdf-parse (PDF extraction)
- diff (word-level diffs)
