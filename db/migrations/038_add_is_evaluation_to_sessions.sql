-- Separate evaluation sessions from training sessions
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS is_evaluation boolean DEFAULT false;

-- Mark session_number=1 as evaluation for clients that have no evaluation record
-- (legacy clients where the adiestrador recorded the evaluation as session 1)
UPDATE sessions s
SET is_evaluation = true
WHERE s.session_number = 1
  AND NOT EXISTS (
    SELECT 1 FROM evaluations e WHERE e.client_id = s.client_id
  );
