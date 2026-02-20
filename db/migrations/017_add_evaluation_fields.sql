-- Add scheduled_date and total_sessions to evaluations table
-- scheduled_date: when the evaluation is planned (set by adiestrador)
-- total_sessions: number of sessions closed (8, 10, or 12)

ALTER TABLE public.evaluations 
ADD COLUMN IF NOT EXISTS scheduled_date DATE,
ADD COLUMN IF NOT EXISTS total_sessions INTEGER CHECK (total_sessions IN (8, 10, 12));
