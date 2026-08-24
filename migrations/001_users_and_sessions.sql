-- Additive only (Bloco 3.1): creates new tables, never alters/drops existing
-- application data. Safe to run against a database that already has other
-- schemas/tables from other projects.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  display_name text NOT NULL,
  -- Text + CHECK today (only two roles needed now), but the extensibility
  -- path for a future intermediate role (e.g. "Editor restrito a um
  -- objetivo") is a separate role_permissions table keyed by role name,
  -- added later without touching this column or existing rows.
  role text NOT NULL CHECK (role IN ('admin', 'viewer')),
  must_change_password boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Server-side sessions (not JWT): chosen so access can be revoked
-- immediately by deleting a row — see server/auth.ts for the full
-- reasoning, as required by the spec to document this decision in code.
CREATE TABLE IF NOT EXISTS sessions (
  token text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
