-- 1. Remove default value (crucial to avoid dependencies)
ALTER TABLE public.leads ALTER COLUMN status DROP DEFAULT;

-- 2. Convert to TEXT explicitly. This makes the column capable of holding ANY string.
ALTER TABLE public.leads ALTER COLUMN status TYPE text USING status::text;

-- 3. Now that it is TEXT, we can safely drop the old enum type if it exists
DROP TYPE IF EXISTS public.lead_status;

-- 4. Re-set default to 'nuevo' (as a simple text string)
ALTER TABLE public.leads ALTER COLUMN status SET DEFAULT 'nuevo';

-- 5. Sanitize data (now safe because the column is text, so comparisons won't fail)
-- Any status that is NOT in our valid list gets converted to 'nuevo'
UPDATE public.leads
SET status = 'nuevo'
WHERE status NOT IN (
    'nuevo',
    'intentando_contactar_lupe',
    'intentando_contactar_aroha',
    'intentando_contactar_pablo',
    'tiene_que_hablarlo_lupe',
    'tiene_que_hablarlo_aroha',
    'tiene_que_hablarlo_pablo',
    'evaluacion_aceptada',
    'evaluacion_aceptada_lupe',
    'evaluacion_aceptada_aroha',
    'evaluacion_aceptada_pablo',
    'evaluacion_denegada_lupe',
    'evaluacion_denegada_aroha',
    'evaluacion_denegada_pablo',
    'perdido'
);

-- 6. Finally, add the constraint to enforce valid values from now on
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_status_check;

ALTER TABLE public.leads ADD CONSTRAINT leads_status_check CHECK (status IN (
    'nuevo',
    'intentando_contactar_lupe',
    'intentando_contactar_aroha',
    'intentando_contactar_pablo',
    'tiene_que_hablarlo_lupe',
    'tiene_que_hablarlo_aroha',
    'tiene_que_hablarlo_pablo',
    'evaluacion_aceptada',
    'evaluacion_aceptada_lupe',
    'evaluacion_aceptada_aroha',
    'evaluacion_aceptada_pablo',
    'evaluacion_denegada_lupe',
    'evaluacion_denegada_aroha',
    'evaluacion_denegada_pablo',
    'perdido'
));
