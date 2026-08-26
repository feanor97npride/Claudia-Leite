-- Additive: Roadmap Timeline visual redesign (mockup fidelity) needs two
-- fields the data model didn't have — a per-atividade subtask checklist
-- (contributing to a computed progress %, shown in the detail panel and as
-- the bar's fill) and an optional bar-color override for an atividade that
-- visually bridges two Objetivos. NULL/empty-array default for every
-- existing row: nothing changes for atividades that don't opt in.
ALTER TABLE atividades ADD COLUMN IF NOT EXISTS subtasks jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE atividades ADD COLUMN IF NOT EXISTS color_override text;
