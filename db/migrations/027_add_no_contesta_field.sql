-- Add no_contesta_at to track when adiestrador marks "No contesta"
-- This removes the client from Llamadas Pendientes and creates an alert for admin

ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS no_contesta_at TIMESTAMPTZ DEFAULT NULL;

-- Optional: add a comment for documentation
COMMENT ON COLUMN public.clients.no_contesta_at IS 'Timestamp when adiestrador marked client as not answering phone. Used to alert admin and track statistics.';
