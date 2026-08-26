-- Backlog: global, persistent items independent of any weekly report — not
-- a per-report narrative like Project (Projetos/Iniciativas da semana),
-- and not a governed roadmap Atividade with a mandatory prazo. A single
-- source of truth shown consistently in Editor, Roadmap Timeline and
-- Snapshot regardless of which historical report is open, same principle
-- already applied to Objetivo/Atividade.
CREATE TABLE IF NOT EXISTS backlog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  objetivo_id text REFERENCES objetivos(id), -- nullable: "Sem categoria"
  priority text NOT NULL DEFAULT 'media' CHECK (priority IN ('alta', 'media', 'baixa')),
  status text NOT NULL DEFAULT 'nao_iniciado' CHECK (status IN ('nao_iniciado', 'em_andamento', 'concluido')),
  estimated_due_date date, -- optional — backlog items are less structured than the formal roadmap
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS backlog_items_objetivo_id_idx ON backlog_items(objetivo_id);
