-- Fix: tg_task_satisfaccion fallaba con "invalid input value for enum client_status: \"\""
-- Causa: coalesce(OLD.status, '') intenta castear '' al enum client_status, que no es un valor válido.
-- Solución: usar IS DISTINCT FROM, que maneja NULL sin coalesce.
create or replace function public.tg_task_satisfaccion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if NEW.status = 'finalizado' and OLD.status is distinct from 'finalizado' then
        perform public.create_task_if_absent(NEW.id, 'satisfaccion',
            'Llamada de Satisfacción al cliente ' || coalesce(NEW.name, '') || ' por término de adiestramiento');
    end if;
    return NEW;
end;
$$;
