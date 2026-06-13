-- ============================================================================
-- Fase 1 — Perfil personalizable, tema y onboarding
-- Añade preferencia de tema y marca de onboarding al perfil, y prepara el
-- Storage de avatares. No toca nada de la economía de fichas ni RLS existente.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Nuevos campos en profiles
-- ----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists onboarding_done boolean not null default false;

-- Preferencia de tema persistida en servidor (opcional; el cliente también
-- la guarda en localStorage). 'system' = seguir al sistema operativo.
alter table public.profiles
  add column if not exists theme text not null default 'system'
  check (theme in ('system', 'light', 'dark'));

-- La política "profiles update own" ya existente permite que cada usuario
-- actualice estos campos en su propia fila.

-- ----------------------------------------------------------------------------
-- 2. Storage de avatares
-- ----------------------------------------------------------------------------
-- Bucket público de solo-lectura; cada usuario solo puede subir/editar dentro
-- de una "carpeta" con su propio uid: avatars/<uid>/...
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Lectura pública (las fotos se muestran en ranking, chat, etc.)
drop policy if exists "avatars public read" on storage.objects;
create policy "avatars public read" on storage.objects
  for select using (bucket_id = 'avatars');

-- Subida: solo en tu propia carpeta (primer segmento del path = tu uid)
drop policy if exists "avatars insert own" on storage.objects;
create policy "avatars insert own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Actualizar/sobrescribir tu propio avatar
drop policy if exists "avatars update own" on storage.objects;
create policy "avatars update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Borrar tu propio avatar
drop policy if exists "avatars delete own" on storage.objects;
create policy "avatars delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
