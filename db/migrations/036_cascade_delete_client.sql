-- Add ON DELETE CASCADE to all FK constraints referencing clients(id)
-- so that deleting a client automatically removes evaluations, sessions, payments and invoices

-- evaluations
ALTER TABLE public.evaluations DROP CONSTRAINT IF EXISTS evaluations_client_id_fkey;
ALTER TABLE public.evaluations ADD CONSTRAINT evaluations_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

-- sessions
ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_client_id_fkey;
ALTER TABLE public.sessions ADD CONSTRAINT sessions_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

-- payments
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_client_id_fkey;
ALTER TABLE public.payments ADD CONSTRAINT payments_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

-- invoices (client_id)
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_client_id_fkey;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

-- invoices (payment_id) — also cascade so invoice is removed when payment is removed
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_payment_id_fkey;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_payment_id_fkey
  FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE CASCADE;
