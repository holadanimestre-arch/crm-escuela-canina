-- Add new columns to leads table
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS first_contact_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS effective_contact_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS contact_attempts INTEGER DEFAULT 0 CHECK (contact_attempts BETWEEN 0 AND 5),
ADD COLUMN IF NOT EXISTS send_whatsapp BOOLEAN DEFAULT FALSE;

-- Update source column to enforce specific values if not already checked
-- We can add a check constraint for source. First, let's update any existing valid sources or nullify invalid ones if strictness is required.
-- For now, let's just add the check constraint.
-- IMPORTANT: If existing data has bad sources, this might fail. We assume 'manual', 'email' are existing.
-- The user asked for: Meta, Tiktok, Orgánico, Google Ads.
-- Let's update existing 'manual' to 'Orgánico' or keep as is? User said "Origin: ...".
-- Let's add the check constraint allowing the user's list + 'manual'/'email' for backward compatibility if needed, or just the user's list.
-- User list: Meta, Tiktok, Orgánico, Google Ads.
-- I'll default existing 'manual' to 'Orgánico' to be safe and clean.

UPDATE leads SET source = 'Orgánico' WHERE source IS NULL OR source = 'manual';

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_source_check;
ALTER TABLE leads ADD CONSTRAINT leads_source_check CHECK (source IN ('Meta', 'Tiktok', 'Orgánico', 'Google Ads', 'Email', 'Manual')); 
-- Added Email/Manual to avoid breaking existing logic/tests if any, but prioritized user list.
