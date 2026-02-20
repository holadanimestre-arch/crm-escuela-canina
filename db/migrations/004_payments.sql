-- PAYMENTS & INVOICES
-- Run this in Supabase SQL Editor

-- 1. Create Payments table
create table if not exists public.payments (
  id uuid default uuid_generate_v4() primary key,
  client_id uuid references public.clients(id) not null,
  amount decimal(10, 2) not null,
  payment_number integer not null check (payment_number in (1, 2)),
  received boolean default false,
  received_at timestamp with time zone,
  method text check (method in ('efectivo', 'transferencia', 'tarjeta')),
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Create Invoices table
create table if not exists public.invoices (
  id uuid default uuid_generate_v4() primary key,
  invoice_number integer generated always as identity,
  client_id uuid references public.clients(id) not null,
  payment_id uuid references public.payments(id),
  amount decimal(10, 2) not null,
  date timestamp with time zone default timezone('utc'::text, now()) not null,
  pdf_url text,
  status text default 'emitida' check (status in ('emitida', 'anulada')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Storage Bucket for Invoices
insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', true)
on conflict (id) do nothing;

-- 4. RLS for Tables
alter table public.payments enable row level security;
alter table public.invoices enable row level security;

-- Policies for Payments
create policy "Admins manage payments" on public.payments for all using (public.is_admin());
create policy "Comerciales manage payments" on public.payments for all using (public.is_comercial());
create policy "Adiestradores view payments" on public.payments for select using (
    public.is_adiestrador() and exists (
        select 1 from public.clients c
        where c.id = payments.client_id and c.city_id = public.get_user_city()
    )
);

-- Policies for Invoices
create policy "Admins manage invoices" on public.invoices for all using (public.is_admin());
create policy "Comerciales manage invoices" on public.invoices for all using (public.is_comercial());
create policy "Adiestradores view invoices" on public.invoices for select using (
    public.is_adiestrador() and exists (
        select 1 from public.clients c
        where c.id = invoices.client_id and c.city_id = public.get_user_city()
    )
);

-- 5. RLS for Storage (Invoices Bucket)
create policy "Admins manage invoice files" on storage.objects for all using (
  bucket_id = 'invoices' and public.is_admin()
);

create policy "Comerciales manage invoice files" on storage.objects for all using (
  bucket_id = 'invoices' and public.is_comercial()
);

create policy "Adiestradores view invoice files" on storage.objects for select using (
  bucket_id = 'invoices' and public.is_adiestrador()
);
