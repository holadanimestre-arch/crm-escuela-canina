-- SESSIONS - Training sessions management
-- Run this in Supabase SQL Editor

create table if not exists public.sessions (
  id uuid default uuid_generate_v4() primary key,
  client_id uuid references public.clients(id) on delete cascade not null,
  session_number integer not null check (session_number between 1 and 8),
  date timestamp with time zone not null,
  completed boolean default false,
  comments text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(client_id, session_number)
);

-- Index for faster lookups
create index if not exists sessions_client_idx on public.sessions(client_id);
create index if not exists sessions_date_idx on public.sessions(date);

-- Enable RLS
alter table public.sessions enable row level security;

-- Policies
create policy "Admins manage sessions" on public.sessions for all using (public.is_admin());

create policy "Adiestradores manage sessions for their city" on public.sessions for all using (
  public.is_adiestrador() and exists (
    select 1 from public.clients c
    where c.id = sessions.client_id and c.city_id = public.get_user_city()
  )
);

create policy "Comerciales view sessions" on public.sessions for select using (public.is_comercial());
