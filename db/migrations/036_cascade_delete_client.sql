-- Cascade delete sessions, evaluations and payments when a client is deleted.
-- Invoices are preserved (financial records) — client_id and payment_id set to NULL.

-- Make invoice foreign keys nullable first
ALTER TABLE public.invoices ALTER COLUMN client_id DROP NOT NULL;
ALTER TABLE public.invoices ALTER COLUMN payment_id DROP NOT NULL;

-- evaluations → cascade
ALTER TABLE public.evaluations DROP CONSTRAINT IF EXISTS evaluations_client_id_fkey;
ALTER TABLE public.evaluations ADD CONSTRAINT evaluations_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

-- sessions → cascade
ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_client_id_fkey;
ALTER TABLE public.sessions ADD CONSTRAINT sessions_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

-- payments → cascade
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_client_id_fkey;
ALTER TABLE public.payments ADD CONSTRAINT payments_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

-- invoices.client_id → set null (keep invoice, clear client reference)
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_client_id_fkey;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;

-- invoices.payment_id → set null (keep invoice, clear payment reference)
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_payment_id_fkey;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_payment_id_fkey
  FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE SET NULL;
