-- Versión MEJORADA de la función de eliminación
-- Permite borrar por ID o por Email (útil para "zombies" que no salen en la lista)

CREATE OR REPLACE FUNCTION public.delete_user_v2(p_user_id UUID DEFAULT NULL, p_email TEXT DEFAULT NULL)
RETURNS void AS $$
BEGIN
  -- Verificar si el usuario que ejecuta es ADMIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Acceso denegado: Solo los administradores pueden realizar esta acción.';
  END IF;

  IF p_user_id IS NOT NULL THEN
    DELETE FROM auth.users WHERE id = p_user_id;
  ELSIF p_email IS NOT NULL THEN
    DELETE FROM auth.users WHERE email = p_email;
  ELSE
    RAISE EXCEPTION 'Debes proporcionar un ID o un Email.';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.delete_user_v2(UUID, TEXT) TO authenticated;
