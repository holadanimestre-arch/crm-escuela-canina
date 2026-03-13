-- 1. Añadir adiestrador_id a CLIENTS
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS adiestrador_id UUID REFERENCES public.profiles(id);
COMMENT ON COLUMN public.clients.adiestrador_id IS 'ID del adiestrador principal asignado al cliente';

-- 2. Añadir adiestrador_id a SESSIONS
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS adiestrador_id UUID REFERENCES public.profiles(id);
COMMENT ON COLUMN public.sessions.adiestrador_id IS 'ID del adiestrador que realiza la sesión';

-- 3. Crear índices para mejorar velocidad de filtrado
CREATE INDEX IF NOT EXISTS idx_clients_adiestrador_id ON public.clients(adiestrador_id);
CREATE INDEX IF NOT EXISTS idx_sessions_adiestrador_id ON public.sessions(adiestrador_id);
