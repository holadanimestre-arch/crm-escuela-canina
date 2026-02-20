-- SEED DATA
-- Updated with Real IDs provided by user and ON CONFLICT handling

-- 1. Cities (Idempotent)
insert into public.cities (id, name, active) values
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Madrid', true),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'Barcelona', true)
on conflict (id) do nothing;

-- 2. Profiles
-- We use ON CONFLICT (id) DO UPDATE to handle the fact that triggers might have already created these profiles.

-- Admin
insert into public.profiles (id, email, full_name, role) values
  ('ba7b762c-54b0-41cc-96b3-917a2ea6bb2a', 'admin@escuela.com', 'Director General', 'admin')
on conflict (id) do update 
set role = excluded.role, full_name = excluded.full_name;

-- Comercial
insert into public.profiles (id, email, full_name, role) values
  ('d3556693-dabb-4349-8242-4dfd5b9b4119', 'comercial@escuela.com', 'Carlos Comercial', 'comercial')
on conflict (id) do update 
set role = excluded.role, full_name = excluded.full_name;

-- Adiestrador (Madrid)
insert into public.profiles (id, email, full_name, role, assigned_city_id) values
  ('0c226fde-d671-4c23-a9b5-e87511b69245', 'adiestrador@escuela.com', 'Ana Adiestradora', 'adiestrador', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
on conflict (id) do update 
set role = excluded.role, full_name = excluded.full_name, assigned_city_id = excluded.assigned_city_id;

-- 3. Leads (Linked to new Comercial ID)
insert into public.leads (name, email, city_id, status, comercial_id, source) values
  ('Juan Interesado', 'juan@test.com', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'nuevo', 'd3556693-dabb-4349-8242-4dfd5b9b4119', 'web'),
  ('Maria Curiosa', 'maria@test.com', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'contactando', 'd3556693-dabb-4349-8242-4dfd5b9b4119', 'email')
on conflict do nothing; -- Assuming generated IDs, if rerunning, we might get duplicates if we don't specify IDs. 
-- Since schema uses uuid_generate_v4(), re-running this block creates NEW leads. 
-- For a cleaner seed, we should hardcode IDs for leads too if we want idempotency, 
-- but for now let's leave it as "append" or manual clear. 
-- To trigger less issues, I will not force IDs here but acknowledge they might duplicate if run multiple times.

-- 4. Clients
-- Cliente 1 in Madrid (Active)
insert into public.clients (id, name, email, city_id, dog_breed, status) values
  ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f66', 'Pedro Cliente', 'pedro@test.com', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Labrador', 'activo')
on conflict (id) do nothing;

-- Evaluation for Cliente 1
insert into public.evaluations (client_id, city_id, result, comments, created_at) values
  ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f66', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'aprobada', 'Perro muy apto', now() - interval '5 days')
on conflict do nothing; -- No ID specified, will append duplicates if run multiple times. Acceptable for dev seed.

-- Sessions for Cliente 1
insert into public.sessions (client_id, session_number, date, completed) values
  ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f66', 1, CURRENT_DATE - 2, true),
  ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f66', 2, CURRENT_DATE + 5, false)
on conflict (client_id, session_number) do update set completed = excluded.completed;

-- Payment for Cliente 1
insert into public.payments (client_id, payment_number, amount, received, received_at, method) values
  ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f66', 1, 350.00, true, now() - interval '2 days', 'tarjeta')
on conflict do nothing; 
