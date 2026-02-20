-- EXTENSIONS
create extension if not exists "uuid-ossp";

-- ENUMS
create type user_role as enum ('admin', 'comercial', 'adiestrador');
create type lead_status as enum ('nuevo', 'contactando', 'pendiente', 'evaluacion_aceptada', 'evaluacion_denegada', 'perdido');
create type client_status as enum ('evaluado', 'activo', 'finalizado');
create type evaluation_result as enum ('aprobada', 'rechazada');
create type payment_method as enum ('efectivo', 'transferencia', 'tarjeta');
create type invoice_status as enum ('emitida', 'anulada');

-- TABLES & RELATIONS

-- 1. PROFILES (Extends Supabase Auth)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text,
  avatar_url text,
  role user_role default 'comercial',
  assigned_city_id uuid, -- Link manually after city creation if needed, or update via logic
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. CITIES
create table public.cities (
  id uuid default uuid_generate_v4() primary key,
  name text not null unique,
  active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Update profiles FK to cities now that table exists
alter table public.profiles 
  add constraint fk_profiles_city 
  foreign key (assigned_city_id) references public.cities(id);

-- 3. LEADS
create table public.leads (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  phone text,
  email text,
  city_id uuid references public.cities(id),
  status lead_status default 'nuevo',
  comercial_id uuid references public.profiles(id),
  notes text,
  source text,
  external_source_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  evaluation_accepted_at timestamp with time zone,
  first_contacted_at timestamp with time zone
);

-- Unique constraint for deduplication on external sources
create unique index leads_external_source_id_idx on public.leads (external_source_id) where external_source_id is not null;

-- 4. CLIENTS
create table public.clients (
  id uuid default uuid_generate_v4() primary key,
  lead_id uuid references public.leads(id),
  name text not null,
  phone text,
  email text,
  address text,
  city_id uuid references public.cities(id) not null,
  dog_breed text,
  dog_age text,
  status client_status default 'evaluado',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  evaluation_done_at timestamp with time zone
);

-- 5. EVALUATIONS
create table public.evaluations (
  id uuid default uuid_generate_v4() primary key,
  client_id uuid references public.clients(id) not null,
  city_id uuid references public.cities(id) not null,
  result evaluation_result not null,
  comments text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. SESSIONS (1 to 8)
create table public.sessions (
  id uuid default uuid_generate_v4() primary key,
  client_id uuid references public.clients(id) not null,
  session_number integer not null check (session_number between 1 and 8),
  date date,
  completed boolean default false,
  comments text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (client_id, session_number) -- Prevent duplicate sessions numbers for same client
);

-- 7. PAYMENTS
create table public.payments (
  id uuid default uuid_generate_v4() primary key,
  client_id uuid references public.clients(id) not null,
  payment_number integer check (payment_number in (1, 2)),
  amount numeric(10, 2) not null,
  received boolean default false,
  received_at timestamp with time zone,
  method payment_method,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 8. INVOICES
create table public.invoices (
  id uuid default uuid_generate_v4() primary key,
  invoice_number integer not null,
  invoice_series text default 'A',
  invoice_date date default CURRENT_DATE,
  client_id uuid references public.clients(id) not null,
  payment_id uuid references public.payments(id) unique not null, -- Strict 1:1
  city_id uuid references public.cities(id),
  amount numeric(10, 2) not null,
  currency text default 'EUR',
  status invoice_status default 'emitida',
  pdf_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- INDEXES for Performance & Filters
create index leads_city_idx on public.leads(city_id);
create index leads_status_idx on public.leads(status);
create index clients_city_idx on public.clients(city_id);
create index evaluations_date_idx on public.evaluations(created_at);
create index sessions_date_idx on public.sessions(date);
create index payments_received_at_idx on public.payments(received_at);
create index invoices_date_idx on public.invoices(invoice_date);

-- ROW LEVEL SECURITY (RLS)

alter table public.profiles enable row level security;
alter table public.cities enable row level security;
alter table public.leads enable row level security;
alter table public.clients enable row level security;
alter table public.evaluations enable row level security;
alter table public.sessions enable row level security;
alter table public.payments enable row level security;
alter table public.invoices enable row level security;

-- Helper Functions
create or replace function public.is_admin()
returns boolean as $$
begin
  return exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
end;
$$ language plpgsql security definer;

create or replace function public.is_comercial()
returns boolean as $$
begin
  return exists (select 1 from public.profiles where id = auth.uid() and role = 'comercial');
end;
$$ language plpgsql security definer;

create or replace function public.is_adiestrador()
returns boolean as $$
begin
  return exists (select 1 from public.profiles where id = auth.uid() and role = 'adiestrador');
end;
$$ language plpgsql security definer;

create or replace function public.get_user_city()
returns uuid as $$
  select assigned_city_id from public.profiles where id = auth.uid();
$$ language sql security definer;

-- POLICIES

-- PROFILES
create policy "Admins managed profiles" on public.profiles for all using (public.is_admin());
create policy "Users view own profile" on public.profiles for select using (auth.uid() = id);

-- CITIES
create policy "Everyone views cities" on public.cities for select using (true);
create policy "Admins manage cities" on public.cities for all using (public.is_admin());

-- LEADS
create policy "Admins manage leads" on public.leads for all using (public.is_admin());
create policy "Comerciales view leads" on public.leads for select using (public.is_comercial());
create policy "Comerciales edit leads" on public.leads for insert with check (public.is_comercial());
create policy "Comerciales update leads" on public.leads for update using (public.is_comercial());
-- Adiestradores don't see leads usually, only confirmed clients? Assuming yes based on 'Comercial deals with leads'.

-- CLIENTS
create policy "Admins manage clients" on public.clients for all using (public.is_admin());
create policy "Comerciales view clients" on public.clients for select using (public.is_comercial());
create policy "Comerciales create clients" on public.clients for insert with check (public.is_comercial());
create policy "Adiestradores view clients in city" on public.clients for select using (
  public.is_adiestrador() and city_id = public.get_user_city()
);

-- EVALUATIONS
create policy "Admins manage evaluations" on public.evaluations for all using (public.is_admin());
create policy "Adiestradores manage evaluations in city" on public.evaluations for all using (
  public.is_adiestrador() and city_id = public.get_user_city()
);
create policy "Comerciales view evaluations" on public.evaluations for select using (public.is_comercial());

-- SESSIONS
create policy "Admins manage sessions" on public.sessions for all using (public.is_admin());
create policy "Adiestradores manage sessions for their clients" on public.sessions for all using (
  public.is_adiestrador() and exists (
    select 1 from public.clients c 
    where c.id = sessions.client_id and c.city_id = public.get_user_city()
  )
);
create policy "Comerciales view sessions" on public.sessions for select using (public.is_comercial());

-- PAYMENTS & INVOICES
create policy "Admins manage finance" on public.payments for all using (public.is_admin());
create policy "Admins manage invoices" on public.invoices for all using (public.is_admin());
-- Comerciales/Adiestradores defined as NOT seeing global finance. 
-- Specific rule: "Adiestrador: no ve pagos ni facturas". 
-- Comercial: "sin métricas financieras globales". 
-- Strict interpretation: they can't select from these tables.

-- AUTOMATION TRIGGERS

-- 1. Auto-assign Dates & Status Logic
create or replace function public.handle_status_updates()
returns trigger as $$
begin
  -- Lead: Evaluation Accepted -> Set date
  if TG_TABLE_NAME = 'leads' and new.status = 'evaluacion_aceptada' and old.status != 'evaluacion_aceptada' then
    new.evaluation_accepted_at = now();
  end if;
  
  -- Lead: First Contact -> Set date
  if TG_TABLE_NAME = 'leads' and old.status = 'nuevo' and new.status != 'nuevo' and new.first_contacted_at is null then
    new.first_contacted_at = now();
  end if;

  return new;
end;
$$ language plpgsql;

create trigger on_lead_status_update
  before update on public.leads
  for each row execute procedure public.handle_status_updates();

-- 2. Auto Invoice Generation on Payment Received
create or replace function public.generate_invoice()
returns trigger as $$
declare
  next_invoice_number integer;
  client_city_id uuid;
begin
  -- Only if received became true
  if new.received = true and (old.received is false or old.received is null) then
    
    -- Set received_at
    new.received_at = now();

    -- Get next invoice number
    select coalesce(max(invoice_number), 0) + 1 into next_invoice_number from public.invoices;

    -- Get client city
    select city_id into client_city_id from public.clients where id = new.client_id;

    -- Insert Invoice
    insert into public.invoices (
      invoice_number,
      client_id,
      payment_id,
      city_id,
      amount,
      status
    ) values (
      next_invoice_number,
      new.client_id,
      new.id,
      client_city_id,
      new.amount,
      'emitida'
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_payment_received
  before update on public.payments
  for each row execute procedure public.generate_invoice();

-- 3. Profile Creation on Auth Signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', 'comercial'); -- Default
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 10. CRM SETTINGS
create table if not exists public.crm_settings (
  id boolean primary key default true,
  constraint single_row check (id = true),
  business_name text,
  business_cif text,
  business_address text,
  business_phone text,
  business_email text,
  business_iban text,
  invoice_footer text,
  invoice_logo_url text,
  default_evaluation_price numeric(10, 2) default 0,
  default_session_price numeric(10, 2) default 0,
  notification_settings jsonb default '{}'::jsonb,
  integration_settings jsonb default '{}'::jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.crm_settings enable row level security;

create policy "Everyone views settings" on public.crm_settings for select using (true);
create policy "Admins manage settings" on public.crm_settings for all using (public.is_admin());

insert into public.crm_settings (id, business_name)
values (true, 'Escuela Canina Fran Estévez')
on conflict (id) do nothing;

