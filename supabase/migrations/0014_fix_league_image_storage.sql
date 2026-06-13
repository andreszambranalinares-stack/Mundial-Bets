-- ============================================================================
-- Fix — Re-asegurar bucket y políticas de Storage de imágenes de liga
-- Re-aplica las políticas de la sección 9 de 0006 en entornos donde el bucket
-- 'league-images' se creó a mano o la migración 0006 nunca llegó a producción.
-- Síntoma que corrige: al cambiar la imagen de una liga el owner recibía
-- "new row violates row-level security policy" en el upload a Storage.
-- Idempotente: se puede ejecutar tantas veces como haga falta.
-- ============================================================================

-- Bucket público de imágenes de liga
insert into storage.buckets (id, name, public)
values ('league-images', 'league-images', true)
on conflict (id) do nothing;

-- Lectura pública
drop policy if exists "league-images public read" on storage.objects;
create policy "league-images public read" on storage.objects
  for select using (bucket_id = 'league-images');

-- Insertar: solo el owner de la liga (carpeta = league_id)
drop policy if exists "league-images insert owner" on storage.objects;
create policy "league-images insert owner" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'league-images'
    and exists (
      select 1 from public.leagues l
      where l.id::text = (storage.foldername(name))[1] and l.owner_id = auth.uid()
    )
  );

-- Actualizar (upsert): solo el owner
drop policy if exists "league-images update owner" on storage.objects;
create policy "league-images update owner" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'league-images'
    and exists (
      select 1 from public.leagues l
      where l.id::text = (storage.foldername(name))[1] and l.owner_id = auth.uid()
    )
  );

-- Borrar: solo el owner
drop policy if exists "league-images delete owner" on storage.objects;
create policy "league-images delete owner" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'league-images'
    and exists (
      select 1 from public.leagues l
      where l.id::text = (storage.foldername(name))[1] and l.owner_id = auth.uid()
    )
  );
