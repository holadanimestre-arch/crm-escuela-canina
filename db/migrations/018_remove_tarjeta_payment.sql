-- Remove 'tarjeta' from payment method options
-- Only allow 'efectivo' and 'transferencia'

-- First update any existing 'tarjeta' payments to 'transferencia'
UPDATE public.payments SET method = 'transferencia' WHERE method = 'tarjeta';

-- Drop old constraint and add new one
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_method_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_method_check CHECK (method IN ('efectivo', 'transferencia'));
