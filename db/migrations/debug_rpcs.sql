CREATE OR REPLACE FUNCTION public.debug_get_all_profiles()
RETURNS SETOF public.profiles AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.profiles;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.debug_get_all_auth_users()
RETURNS TABLE (id uuid, email text, created_at timestamp with time zone) AS $$
BEGIN
  RETURN QUERY SELECT u.id, u.email::text, u.created_at FROM auth.users u;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
