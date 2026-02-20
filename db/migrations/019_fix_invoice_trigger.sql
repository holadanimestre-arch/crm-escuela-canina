-- 1. Helper for received_at (BEFORE)
CREATE OR REPLACE FUNCTION public.handle_payment_metadata()
RETURNS trigger AS $$
BEGIN
  IF NEW.received = true AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (OLD.received IS FALSE OR OLD.received IS NULL))) THEN
    IF NEW.received_at IS NULL THEN
      NEW.received_at = now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_payment_metadata ON public.payments;
CREATE TRIGGER on_payment_metadata
  BEFORE INSERT OR UPDATE ON public.payments
  FOR EACH ROW EXECUTE PROCEDURE public.handle_payment_metadata();

-- 2. Helper for invoice generation (AFTER)
CREATE OR REPLACE FUNCTION public.generate_invoice()
RETURNS trigger AS $$
DECLARE
  next_invoice_number integer;
  client_city_id uuid;
BEGIN
  IF NEW.received = true AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (OLD.received IS FALSE OR OLD.received IS NULL))) THEN
    
    -- Get next invoice number
    SELECT COALESCE(MAX(invoice_number), 0) + 1 INTO next_invoice_number FROM public.invoices;

    -- Get client city
    SELECT city_id INTO client_city_id FROM public.clients WHERE id = NEW.client_id;

    -- Insert Invoice
    INSERT INTO public.invoices (
      invoice_number,
      client_id,
      payment_id,
      city_id,
      amount,
      status
    ) VALUES (
      next_invoice_number,
      NEW.client_id,
      NEW.id,
      client_city_id,
      NEW.amount,
      'emitida'
    ) ON CONFLICT (payment_id) DO NOTHING;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_payment_received ON public.payments;
CREATE TRIGGER on_payment_received
  AFTER INSERT OR UPDATE ON public.payments
  FOR EACH ROW EXECUTE PROCEDURE public.generate_invoice();
