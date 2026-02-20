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
