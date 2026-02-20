-- 1. Sanitize data: set any unknown status to 'nuevo'
-- This fixes the row violation error by ensuring all data complies before adding the rule
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

-- 2. Drop the constraint if it exists (just in case)
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_status_check;

-- 3. Now verify and add the constraint exactly as we want it
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
