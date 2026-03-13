-- Remove the check constraint that limited payment_number to only (1, 2)
-- This allows clients to have any number of payments (P1, P2, P3, P4...)

ALTER TABLE public.payments
DROP CONSTRAINT IF EXISTS payments_payment_number_check;

-- Add a new constraint that only requires the number to be positive
ALTER TABLE public.payments
ADD CONSTRAINT payments_payment_number_positive CHECK (payment_number > 0);
