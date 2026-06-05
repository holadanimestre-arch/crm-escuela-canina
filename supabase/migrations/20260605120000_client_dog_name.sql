-- Nombre del perro en la ficha de cliente
alter table public.clients add column if not exists dog_name text;
