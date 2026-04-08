-- ============================================================
-- MIGRACIÓN: Relación N:M entre Adiestradores y Ciudades
-- ============================================================
-- Este script crea la tabla intermedia adiestrador_cities 
-- y migra los datos existentes de assigned_city_id.
-- 
-- EJECUTAR EN: Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. Crear tabla intermedia
CREATE TABLE IF NOT EXISTS public.adiestrador_cities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    city_id UUID NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(profile_id, city_id)
);

-- 2. Habilitar RLS
ALTER TABLE public.adiestrador_cities ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de acceso (lectura para todos los autenticados, escritura solo admin)
CREATE POLICY "Authenticated users can read adiestrador_cities"
    ON public.adiestrador_cities
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Admin can insert adiestrador_cities"
    ON public.adiestrador_cities
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Admin can update adiestrador_cities"
    ON public.adiestrador_cities
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Admin can delete adiestrador_cities"
    ON public.adiestrador_cities
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- 4. Migrar datos existentes de assigned_city_id a la nueva tabla
INSERT INTO public.adiestrador_cities (profile_id, city_id)
SELECT id, assigned_city_id
FROM public.profiles
WHERE role = 'adiestrador'
  AND assigned_city_id IS NOT NULL
ON CONFLICT (profile_id, city_id) DO NOTHING;

-- 5. Verificar la migración
SELECT 
    p.email, 
    p.full_name, 
    p.assigned_city_id AS old_city_id,
    ac.city_id AS new_city_id,
    c.name AS city_name
FROM public.profiles p
LEFT JOIN public.adiestrador_cities ac ON ac.profile_id = p.id
LEFT JOIN public.cities c ON c.id = ac.city_id
WHERE p.role = 'adiestrador'
ORDER BY p.full_name;

-- ============================================================
-- NOTA: NO eliminamos assigned_city_id de profiles todavía.
-- Lo dejaremos como campo legacy hasta que todo funcione bien.
-- Cuando todo esté validado, se podrá eliminar con:
-- ALTER TABLE public.profiles DROP COLUMN assigned_city_id;
-- ============================================================
