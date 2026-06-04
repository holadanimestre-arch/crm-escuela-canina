-- Tabla de notificaciones internas (avisos de adiestradores a administradores)
create table if not exists public.notifications (
    id uuid primary key default gen_random_uuid(),
    type text not null default 'no_contesta',
    title text not null,
    message text,
    client_id uuid references public.clients(id) on delete set null,
    created_by uuid references public.profiles(id) on delete set null,
    read boolean not null default false,
    created_at timestamptz not null default now()
);

create index if not exists notifications_created_at_idx on public.notifications (created_at desc);
create index if not exists notifications_read_idx on public.notifications (read);

alter table public.notifications enable row level security;

-- Los administradores pueden ver todas las notificaciones
drop policy if exists "Admins can view notifications" on public.notifications;
create policy "Admins can view notifications"
on public.notifications for select
to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Cualquier usuario autenticado (p. ej. adiestradores) puede crear notificaciones
drop policy if exists "Authenticated can create notifications" on public.notifications;
create policy "Authenticated can create notifications"
on public.notifications for insert
to authenticated
with check (true);

-- Los administradores pueden actualizar (marcar como leída)
drop policy if exists "Admins can update notifications" on public.notifications;
create policy "Admins can update notifications"
on public.notifications for update
to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
