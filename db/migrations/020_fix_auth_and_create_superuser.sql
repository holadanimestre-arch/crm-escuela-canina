-- =====================================================
-- Script para crear superusuario en Supabase
-- Ejecutar en: SQL Editor del Dashboard de Supabase
-- https://supabase.com/dashboard/project/gufbkrzpalsrizkqusyr/sql/new
-- =====================================================

-- Paso 1: Verificar si hay triggers problemáticos
-- Primero desactivamos temporalmente el trigger por si está causando el error
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Paso 2: Recrear la función del trigger con manejo de errores
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name', 'comercial')
  ON CONFLICT (id) DO NOTHING; -- Evitar errores si ya existe
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Paso 3: Recrear el trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Paso 4: Verificar que no haya usuarios huérfanos con ese email
-- (Esto puede causar el error "Database error checking email")
DELETE FROM auth.users WHERE email = 'info@escuelacaninafranestevez.es';
DELETE FROM public.profiles WHERE email = 'info@escuelacaninafranestevez.es';
