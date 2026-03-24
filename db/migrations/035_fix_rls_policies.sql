DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Adiestradores update clients in city') THEN
    CREATE POLICY "Adiestradores update clients in city" ON public.clients FOR UPDATE
    USING (public.is_adiestrador() AND city_id = public.get_user_city())
    WITH CHECK (public.is_adiestrador() AND city_id = public.get_user_city());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Comerciales view payments') THEN
    CREATE POLICY "Comerciales view payments" ON public.payments FOR SELECT
    USING (public.is_comercial());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Adiestradores view payments for their clients') THEN
    CREATE POLICY "Adiestradores view payments for their clients" ON public.payments FOR SELECT
    USING (public.is_adiestrador() AND EXISTS (
      SELECT 1 FROM public.clients c WHERE c.id = payments.client_id AND c.city_id = public.get_user_city()
    ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Adiestradores view evaluations in city') THEN
    CREATE POLICY "Adiestradores view evaluations in city" ON public.evaluations FOR SELECT
    USING (public.is_adiestrador() AND EXISTS (
      SELECT 1 FROM public.clients c WHERE c.id = evaluations.client_id AND c.city_id = public.get_user_city()
    ));
  END IF;
END $$;
