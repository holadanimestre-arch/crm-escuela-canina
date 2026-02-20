-- Drop existing check constraint
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;

-- Update existing data to match new schema (Migration Strategy: Default to 'Lupe' for generics)
UPDATE leads SET status = 'intentando_contactar_lupe' WHERE status = 'contactando';
UPDATE leads SET status = 'tiene_que_hablarlo_lupe' WHERE status = 'pendiente';
UPDATE leads SET status = 'evaluacion_aceptada_lupe' WHERE status = 'evaluacion_aceptada';
UPDATE leads SET status = 'evaluacion_denegada_lupe' WHERE status = 'evaluacion_denegada';

-- Add new check constraint with specific statuses
ALTER TABLE leads ADD CONSTRAINT leads_status_check CHECK (status IN (
    'nuevo',
    'intentando_contactar_lupe',
    'intentando_contactar_aroha',
    'intentando_contactar_pablo',
    'tiene_que_hablarlo_lupe',
    'tiene_que_hablarlo_aroha',
    'tiene_que_hablarlo_pablo',
    'evaluacion_aceptada_lupe',
    'evaluacion_aceptada_aroha',
    'evaluacion_aceptada_pablo',
    'evaluacion_denegada_lupe',
    'evaluacion_denegada_aroha',
    'evaluacion_denegada_pablo',
    'perdido'
));
