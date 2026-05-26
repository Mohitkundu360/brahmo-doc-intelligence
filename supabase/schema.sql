-- BRAHMO Document Intelligence — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor

create extension if not exists "uuid-ossp";

-- Knowledge nodes (firm rules, constraints, decisions)
create table knowledge_nodes (
  id text primary key,               -- e.g. "C-010"
  node_type text not null,           -- CONSTRAINT | ANTI_PATTERN | DECISION
  title text not null,
  content text not null,
  practice_area text default 'corporate',
  tags jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

-- Uploaded documents
create table documents (
  id uuid primary key default uuid_generate_v4(),
  filename text not null,
  content_text text,
  uploaded_at timestamptz default now()
);

-- Document chunks (individual clauses)
create table document_chunks (
  id uuid primary key default uuid_generate_v4(),
  document_id uuid references documents(id) on delete cascade,
  chunk_index integer not null,
  clause_number text,
  clause_title text,
  clause_type text,
  text text not null,
  created_at timestamptz default now()
);

-- Risk scores per chunk
create table risk_scores (
  id uuid primary key default uuid_generate_v4(),
  chunk_id uuid references document_chunks(id) on delete cascade,
  score integer not null check (score between 1 and 10),
  risk_level text not null,          -- LOW | MEDIUM | HIGH
  risk_factors jsonb default '[]'::jsonb,
  constraint_violations jsonb default '[]'::jsonb,
  recommendation text,
  created_at timestamptz default now()
);

-- Comparison results between two document versions
create table comparison_results (
  id uuid primary key default uuid_generate_v4(),
  doc_v1_id uuid references documents(id),
  doc_v2_id uuid references documents(id),
  chunk_v1_id uuid references document_chunks(id),
  chunk_v2_id uuid references document_chunks(id),
  match_type text not null,          -- UNCHANGED | MODIFIED | ADDED | REMOVED
  similarity_score float,
  diff_text text,
  risk_delta text,                   -- INCREASED | DECREASED | UNCHANGED
  score_v1 integer,
  score_v2 integer,
  created_at timestamptz default now()
);

-- Enable Row Level Security (allow public reads for demo)
alter table knowledge_nodes enable row level security;
alter table documents enable row level security;
alter table document_chunks enable row level security;
alter table risk_scores enable row level security;
alter table comparison_results enable row level security;

create policy "Public read" on knowledge_nodes for select using (true);
create policy "Public insert" on knowledge_nodes for insert with check (true);
create policy "Public read" on documents for select using (true);
create policy "Public insert" on documents for insert with check (true);
create policy "Public read" on document_chunks for select using (true);
create policy "Public insert" on document_chunks for insert with check (true);
create policy "Public read" on risk_scores for select using (true);
create policy "Public insert" on risk_scores for insert with check (true);
create policy "Public read" on comparison_results for select using (true);
create policy "Public insert" on comparison_results for insert with check (true);
