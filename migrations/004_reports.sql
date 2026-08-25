-- Weekly Status Report data previously lived only in the browser's
-- localStorage (see src/lib/storage.ts), which is lost whenever the report
-- is opened from a different browser/device/preview URL — this table makes
-- it server-authoritative like Objetivo/Atividade already are. Additive
-- only; `data` mirrors the client's Report shape (everything but id/userId/
-- weekStart/createdAt/updatedAt, which get their own columns) as JSONB so no
-- schema change is needed as report fields evolve.
CREATE TABLE IF NOT EXISTS reports (
  id text PRIMARY KEY, -- client-generated (crypto.randomUUID()), same as before in localStorage
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reports_user_week_idx ON reports(user_id, week_start DESC);
