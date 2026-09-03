-- Add progresso (progress percentage) to atividades
-- Auto-sync: done=100%, planned/others=0% by default, in_progress can be edited 1-99%

ALTER TABLE atividades ADD COLUMN progresso INTEGER DEFAULT 0 CHECK (progresso BETWEEN 0 AND 100);

-- Seed existing data: completed activities get 100%, others get 0%
UPDATE atividades SET progresso = 100 WHERE status = 'done';
