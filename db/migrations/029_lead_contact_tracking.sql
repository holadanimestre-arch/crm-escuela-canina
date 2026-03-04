-- Add missing contact tracking columns to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS effective_contact_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS contact_attempts integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS send_whatsapp boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS last_whatsapp_sent_at timestamp with time zone;

-- Add comment to explain columns
COMMENT ON COLUMN public.leads.effective_contact_at IS 'Timestamp of the first successful/effective contact with the lead';
COMMENT ON COLUMN public.leads.contact_attempts IS 'Number of times the commercial has tried to contact the lead';
COMMENT ON COLUMN public.leads.send_whatsapp IS 'Flag to trigger an automated WhatsApp message via Edge Function';
COMMENT ON COLUMN public.leads.last_whatsapp_sent_at IS 'Timestamp of the last WA message sent to this lead';
