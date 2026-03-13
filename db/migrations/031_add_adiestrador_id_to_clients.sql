-- Añadir columna adiestrador_id a clients si no existe
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS adiestrador_id UUID REFERENCES public.profiles(id);

-- Comentario descriptivo
COMMENT ON COLUMN public.clients.adiestrador_id IS 'ID del adiestrador asignado al cliente';

-- Actualizar clientes existentes (opcional: podrías intentar deducirlo de las evaluaciones o sesiones, 
-- pero para nuevos clientes será obligatorio al aprobar)
