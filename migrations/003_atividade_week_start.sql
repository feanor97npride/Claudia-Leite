-- Additive (Bloco 3): scopes an extra atividade to the week it was created
-- in, so it stops showing up in the live Roadmap editor once that week
-- passes. NULL for every existing row (planned atividades, and extras
-- created before this migration) means "always visible" — no surprise
-- disappearance for pre-existing data.
ALTER TABLE atividades ADD COLUMN week_start DATE;
