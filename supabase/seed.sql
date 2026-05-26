-- BRAHMO Seed Data — 10 Firm Knowledge Nodes
-- Run AFTER schema.sql in Supabase SQL Editor

insert into knowledge_nodes (id, node_type, title, content, practice_area, tags) values
(
  'C-010', 'CONSTRAINT', 'Liability Cap',
  'Firm policy: liability in any contract must be capped at maximum 2x the annual contract value. Uncapped liability = automatic HIGH risk flag.',
  'corporate', '["contract", "liability"]'::jsonb
),
(
  'C-011', 'CONSTRAINT', 'Non-Compete Duration',
  'Firm policy: non-compete and non-solicitation clauses must not exceed 12 months. Any duration > 12 months must be rejected or negotiated down.',
  'corporate', '["contract", "non_compete"]'::jsonb
),
(
  'C-012', 'CONSTRAINT', 'IP Carve-Out',
  'Firm policy: IP assignment clauses must include carve-out for pre-existing IP. Broad all IP assignments without carve-out = HIGH risk.',
  'corporate', '["contract", "ip"]'::jsonb
),
(
  'C-013', 'CONSTRAINT', 'Arbitration Preference',
  'Firm policy: arbitration (SIAC or LCIA rules) preferred over litigation for cross-border contracts. Removal of arbitration clause = flag for review.',
  'corporate', '["contract", "dispute"]'::jsonb
),
(
  'C-014', 'CONSTRAINT', 'Termination Notice',
  'Firm policy: termination for convenience must have minimum 90 days notice. Shorter notice periods disadvantage our clients.',
  'corporate', '["contract", "termination"]'::jsonb
),
(
  'AP-010', 'ANTI_PATTERN', 'One-sided Indemnification',
  'Do not accept one-sided indemnification in vendor contracts. Past case: client liable for vendor data breach because indemnity was one-way. Always insist on mutual indemnification.',
  'corporate', '["contract", "indemnity"]'::jsonb
),
(
  'AP-011', 'ANTI_PATTERN', 'Auto-renewal Short Opt-out',
  'Watch for auto-renewal clauses with short opt-out windows. Past case: client locked into 3-year renewal because opt-out was 30 days and they missed it. Flag any opt-out < 90 days.',
  'corporate', '["contract", "auto_renewal"]'::jsonb
),
(
  'D-010', 'DECISION', 'Return of Materials Mandatory',
  'TechCorp NDA (2026): Client lost trade secret protection because NDA had no return of materials clause. Now MANDATORY: every NDA must include return/destruction of confidential materials on termination.',
  'corporate', '["nda", "materials"]'::jsonb
),
(
  'D-011', 'DECISION', 'Proportionate Liquidated Damages',
  'Sharma Services Agreement (2025): Liquidated damages clause struck down as penalty because amount was disproportionate (10x breach value). Lesson: keep LD clauses proportionate to actual estimated loss.',
  'corporate', '["contract", "penalty"]'::jsonb
),
(
  'D-012', 'DECISION', 'Clear Dispute Resolution',
  'ABC Cross-Border (2026): Won jurisdiction challenge because contract specified SIAC Singapore. Opponent tried Indian courts — dismissed. Lesson: clear dispute resolution clause saves months of fighting.',
  'corporate', '["contract", "jurisdiction"]'::jsonb
);
