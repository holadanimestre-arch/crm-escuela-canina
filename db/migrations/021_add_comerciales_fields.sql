-- Add avatar_url to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- Add first_contacted_at to leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS first_contacted_at timestamp with time zone;

-- Create function to auto-update first_contacted_at
CREATE OR REPLACE FUNCTION public.handle_lead_first_contact()
RETURNS trigger AS $$
BEGIN
  -- If status changes from 'nuevo' to something else, and first_contacted_at is null
  IF old.status = 'nuevo' AND new.status != 'nuevo' AND new.first_contacted_at IS NULL THEN
    new.first_contacted_at = now();
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on leads
DROP TRIGGER IF EXISTS on_lead_first_contact ON public.leads;
CREATE TRIGGER on_lead_first_contact
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE PROCEDURE public.handle_lead_first_contact();
