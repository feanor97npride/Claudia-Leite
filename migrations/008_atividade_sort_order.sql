-- Add sort_order to atividades — lets a user drag-and-drop reposition
-- atividades within an objetivo's Timeline group instead of always showing
-- them in creation order. DOUBLE PRECISION (not INTEGER) so a single drop
-- can set a new row's order to the midpoint between its two neighbors
-- without ever needing to renumber the rest of the group.

ALTER TABLE atividades ADD COLUMN sort_order DOUBLE PRECISION;

-- Backfill: existing creation order, per objetivo, with wide (1000) gaps so
-- there's plenty of room for future fractional inserts before precision
-- becomes a concern.
WITH ranked AS (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY objetivo_id ORDER BY created_at ASC) - 1) * 1000 AS rn
  FROM atividades
)
UPDATE atividades SET sort_order = ranked.rn FROM ranked WHERE atividades.id = ranked.id;

ALTER TABLE atividades ALTER COLUMN sort_order SET NOT NULL;
ALTER TABLE atividades ALTER COLUMN sort_order SET DEFAULT 0;
