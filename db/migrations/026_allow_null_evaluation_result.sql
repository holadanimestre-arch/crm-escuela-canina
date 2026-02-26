-- Allow evaluations to be created without a result (adiestrador schedules first, then fills result later)
-- This enables the workflow: Schedule evaluation → Do evaluation → Set result

ALTER TABLE public.evaluations ALTER COLUMN result DROP NOT NULL;
