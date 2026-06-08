-- El nº de sesiones contratadas (evaluations.total_sessions) puede ser 8, 10, 12
-- o ampliarse si el cliente decide seguir. El CHECK original
-- (session_number between 1 and 8) impedía agendar más de 8 sesiones.
-- Relajamos el límite a 1..50 para permitir corregir/ampliar el contrato.

do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'sessions'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%session_number%between%'
  loop
    execute format('alter table public.sessions drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.sessions
  add constraint sessions_session_number_check
  check (session_number between 1 and 50);
