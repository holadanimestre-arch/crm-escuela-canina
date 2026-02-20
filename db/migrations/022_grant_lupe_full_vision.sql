-- Give Lupe (comercial) full "vision de todo" by updating is_admin helper
-- This allows her to bypass role checks in RLS policies without changing her role to 'admin'
-- (Maintaining her as 'comercial' for rankings and dashboard stats)

create or replace function public.is_admin()
returns boolean as $$
begin
  return exists (select 1 from public.profiles where id = auth.uid() and (role = 'admin' or email = 'lupe@escuelacaninafranestevez.es'));
end;
$$ language plpgsql security definer;
