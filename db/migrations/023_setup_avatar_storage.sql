-- Configuración de almacenamiento para Avatars
-- Ejecuta esto en el SQL Editor de Supabase

-- 1. Crear el bucket si no existe
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- 2. Permitir acceso público a las fotos (LECTURA)
create policy "Public Access to Avatars"
on storage.objects for select
using ( bucket_id = 'avatars' );

-- 3. Permitir a los Admins gestionar todo en el bucket avatars
-- (Esto ya incluye a Lupe por la función is_admin() que actualizamos)
create policy "Admins can manage avatars"
on storage.objects for all
using ( 
  bucket_id = 'avatars' 
  and public.is_admin() 
);

-- 4. Permitir a los Comerciales gestionar sus propias fotos o las de otros si tienen permiso
-- (Opcional: Si quieres que un comercial normal pueda subir su propia foto)
create policy "Comerciales can manage avatars"
on storage.objects for all
using ( 
  bucket_id = 'avatars' 
  and (public.is_comercial() or public.is_admin())
);

-- 5. AJUSTE DE PERMISOS EN PROFILES: Permitir actualización de avatar
-- Sin esto, el usuario no puede guardar la URL en su perfil
create policy "Users can update own profile"
on public.profiles for update
using ( auth.uid() = id )
with check ( auth.uid() = id );
