-- Justificantes bancarios de los pagos
-- 1. Columna en payments para guardar la ruta del fichero en Storage
alter table public.payments add column if not exists receipt_path text;

-- 2. Bucket privado para los justificantes (imágenes / PDF)
insert into storage.buckets (id, name, public)
values ('justificantes', 'justificantes', false)
on conflict (id) do nothing;

-- 3. Permisos de Storage: usuarios autenticados (personal) gestionan el bucket
drop policy if exists "justificantes read" on storage.objects;
create policy "justificantes read"
on storage.objects for select
to authenticated
using (bucket_id = 'justificantes');

drop policy if exists "justificantes insert" on storage.objects;
create policy "justificantes insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'justificantes');

drop policy if exists "justificantes update" on storage.objects;
create policy "justificantes update"
on storage.objects for update
to authenticated
using (bucket_id = 'justificantes')
with check (bucket_id = 'justificantes');

drop policy if exists "justificantes delete" on storage.objects;
create policy "justificantes delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'justificantes');
