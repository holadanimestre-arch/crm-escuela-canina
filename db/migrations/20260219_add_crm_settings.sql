
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

-- RLS
alter table public.crm_settings enable row level security;

create policy "Everyone views settings" on public.crm_settings for select using (true);
create policy "Admins manage settings" on public.crm_settings for all using (public.is_admin());

-- Insert default row
insert into public.crm_settings (id, business_name)
values (true, 'Escuela Canina Fran Estévez')
on conflict (id) do nothing;
