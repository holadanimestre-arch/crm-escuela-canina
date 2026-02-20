-- Arreglar restricciones para permitir eliminar usuarios (Versión corregida)

-- 1. En la tabla LEADS (Esta es la que bloquea a Carlos)
alter table public.leads
  drop constraint if exists leads_comercial_id_fkey,
  add constraint leads_comercial_id_fkey 
    foreign key (comercial_id) 
    references public.profiles(id) 
    on delete set null;

-- 2. En la tabla EVALUATIONS
-- Solo lo aplicamos si la columna existe (para evitar el error que te dio)
do $$ 
begin 
    if exists (select 1 from information_schema.columns where table_name='evaluations' and column_name='adiestrador_id') then
        execute 'alter table public.evaluations drop constraint if exists evaluations_adiestrador_id_fkey';
        execute 'alter table public.evaluations add constraint evaluations_adiestrador_id_fkey foreign key (adiestrador_id) references public.profiles(id) on delete set null';
    end if;
end $$;
