-- Sistema de Tareas (para administración / Lupe)

create table if not exists public.tasks (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    due_date date,
    status text not null default 'pendiente',           -- 'pendiente' | 'completada'
    completed_at timestamptz,
    client_id uuid references public.clients(id) on delete cascade,
    type text not null default 'manual',                -- 'manual' | 'no_contesta' | 'calidad_3' | 'satisfaccion'
    created_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now()
);

create index if not exists tasks_status_due_idx on public.tasks (status, due_date);
create index if not exists tasks_client_type_idx on public.tasks (client_id, type, status);

alter table public.tasks enable row level security;

-- Los administradores gestionan las tareas
drop policy if exists "Admins manage tasks" on public.tasks;
create policy "Admins manage tasks"
on public.tasks for all
to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Helper: crea la tarea solo si no hay otra abierta del mismo tipo para ese cliente
create or replace function public.create_task_if_absent(p_client uuid, p_type text, p_title text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if p_client is null then
        return;
    end if;
    if exists (select 1 from public.tasks where client_id = p_client and type = p_type and status = 'pendiente') then
        return;
    end if;
    insert into public.tasks (title, due_date, status, client_id, type)
    values (p_title, current_date, 'pendiente', p_client, p_type);
end;
$$;

-- 1. "No contesta" → tarea de llamar al cliente (al crearse la notificación)
create or replace function public.tg_task_no_contesta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_name text;
begin
    if NEW.type = 'no_contesta' and NEW.client_id is not null then
        select name into v_name from public.clients where id = NEW.client_id;
        perform public.create_task_if_absent(NEW.client_id, 'no_contesta',
            'Llamar al cliente ' || coalesce(v_name, '') || ' porque no ha contestado al adiestrador');
    end if;
    return NEW;
end;
$$;
drop trigger if exists task_no_contesta on public.notifications;
create trigger task_no_contesta after insert on public.notifications
for each row execute function public.tg_task_no_contesta();

-- 2. 3ª sesión completada → tarea de llamada de calidad
create or replace function public.tg_task_calidad_3()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_name text;
begin
    if NEW.completed = true
       and NEW.session_number = 3
       and coalesce(NEW.is_evaluation, false) = false
       and (TG_OP = 'INSERT' or coalesce(OLD.completed, false) = false) then
        select name into v_name from public.clients where id = NEW.client_id;
        perform public.create_task_if_absent(NEW.client_id, 'calidad_3',
            'Llamada de calidad al cliente ' || coalesce(v_name, '') || ' por 3ª sesión completada');
    end if;
    return NEW;
end;
$$;
drop trigger if exists task_calidad_3 on public.sessions;
create trigger task_calidad_3 after insert or update on public.sessions
for each row execute function public.tg_task_calidad_3();

-- 3. Cliente finalizado → tarea de llamada de satisfacción
create or replace function public.tg_task_satisfaccion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if NEW.status = 'finalizado' and coalesce(OLD.status, '') <> 'finalizado' then
        perform public.create_task_if_absent(NEW.id, 'satisfaccion',
            'Llamada de Satisfacción al cliente ' || coalesce(NEW.name, '') || ' por término de adiestramiento');
    end if;
    return NEW;
end;
$$;
drop trigger if exists task_satisfaccion on public.clients;
create trigger task_satisfaccion after update on public.clients
for each row execute function public.tg_task_satisfaccion();
