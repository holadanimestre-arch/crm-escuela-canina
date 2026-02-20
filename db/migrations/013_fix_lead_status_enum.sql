-- 1. Drop the default value causing the dependency
ALTER TABLE public.leads ALTER COLUMN status DROP DEFAULT;

-- 2. Convert the column to text (data is preserved)
ALTER TABLE public.leads ALTER COLUMN status TYPE text;

-- 3. Now we can safely drop the enum type
DROP TYPE IF EXISTS public.lead_status;

-- 4. Set the default value again (as a simple string now)
ALTER TABLE public.leads ALTER COLUMN status SET DEFAULT 'nuevo';

-- 5. Drop any old check constraints
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_status_check;

-- 6. Add the final comprehensive check constraint
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
