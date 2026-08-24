-- Server-authoritative roadmap tables (Objetivo/Atividade). These become the
-- single source of truth so that role checks and audit logging are actually
-- enforced server-side, not just hidden in the UI. Weekly Report/Project
-- data is untouched by this migration and keeps living in the browser's
-- localStorage as before (Bloco 3: additive only, nothing existing changes).
CREATE TABLE IF NOT EXISTS objetivos (
  id text PRIMARY KEY, -- stable slug, e.g. 'diagnostico' — never renamed, only its display fields are
  name text NOT NULL,
  entrega_label text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  period_label text NOT NULL,
  total_weeks integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Bloco 1.5: previous date ranges are preserved here (insert-only, never
-- updated/deleted) whenever an Objetivo's range changes, so "planejamento
-- original vs. atual" stays comparable rather than being silently
-- overwritten.
CREATE TABLE IF NOT EXISTS objetivo_versions (
  id bigserial PRIMARY KEY,
  objetivo_id text NOT NULL REFERENCES objetivos(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  period_label text NOT NULL,
  total_weeks integer NOT NULL,
  changed_reason text,
  changed_by uuid REFERENCES users(id),
  superseded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS atividades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  objetivo_id text NOT NULL REFERENCES objetivos(id), -- required at the DB level: an atividade can never be orphaned
  name text NOT NULL,
  status text NOT NULL CHECK (status IN ('planned', 'in_progress', 'done')),
  kind text NOT NULL CHECK (kind IN ('planned', 'extra')),
  note text,
  planned_start date,
  planned_end date,
  completed_at date,
  -- RACI (Bloco 1.3): descriptive-only fields, unrelated to the system
  -- access role (admin/viewer) from users.role.
  raci_accountable_name text, -- "Responsável"
  raci_responsible_name text, -- "Executor"
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS atividades_objetivo_id_idx ON atividades(objetivo_id);

-- Bloco 1.1: change log. change_type is derived server-side from which
-- field changed (see server/audit.ts), not chosen by the client.
CREATE TABLE IF NOT EXISTS audit_log (
  id bigserial PRIMARY KEY,
  entity_type text NOT NULL CHECK (entity_type IN ('objetivo', 'atividade')),
  entity_id text NOT NULL,
  field text NOT NULL,
  old_value text,
  new_value text,
  change_type text NOT NULL CHECK (change_type IN ('escopo', 'prazo', 'status', 'outro')),
  reason text, -- required by the API for 'prazo' changes on already-completed-planning activities
  user_id uuid REFERENCES users(id), -- null only for automated/system actions
  actor_label text NOT NULL, -- denormalized display name (or "sistema automatizado"), durable even if the user is later removed
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_entity_idx ON audit_log(entity_type, entity_id);
