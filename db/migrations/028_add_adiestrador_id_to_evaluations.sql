-- Añadir columna adiestrador_id a evaluations si no existe
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS adiestrador_id UUID REFERENCES profiles(id);

-- Opcional: comentario para aclarar el propósito
COMMENT ON COLUMN evaluations.adiestrador_id IS 'ID del adiestrador que realiza o agenda la evaluación';
