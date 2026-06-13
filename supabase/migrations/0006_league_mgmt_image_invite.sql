-- ============================================================================
-- Fase 2 — Gestión de liga, imagen de liga e invitación por enlace
-- Añade imagen y flag de invitación a las ligas, funciones para abandonar/
-- eliminar/transferir y lectura pública controlada de una liga por su código.
-- No toca la economía de fichas.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Nuevos campos en leagues
-- ----------------------------------------------------------------------------
alter table public.leagues add column if not exists image_url text;
alter table public.leagues add column if not exists invite_active boolean not null default true;

-- ----------------------------------------------------------------------------
-- 2. RPC: abandonar liga
--    - Si el que abandona es el owner y quedan otros miembros, la propiedad
--      pasa al miembro más antiguo.
--    - Si es el owner y es el único miembro, se elimina la liga entera.
-- ----------------------------------------------------------------------------
create or replace function public.leave_league(p_league_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_league    public.leagues;
  v_next_owner uuid;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;

  select * into v_league from public.leagues where id = p_league_id;
  if v_league.id is null then raise exception 'Liga no encontrada'; end if;

  if not exists (select 1 from public.league_members
                 where league_id = p_league_id and user_id = v_uid) then
    raise exception 'No perteneces a esta liga';
  end if;

  if v_league.owner_id = v_uid then
    -- Buscar al siguiente miembro más antiguo (excluyéndome)
    select user_id into v_next_owner from public.league_members
    where league_id = p_league_id and user_id <> v_uid
    order by joined_at asc
    limit 1;

    if v_next_owner is null then
      -- Soy el único miembro -> eliminar la liga (cascade limpia todo)
      delete from public.leagues where id = p_league_id;
      return;
    end if;

    -- Transferir la propiedad antes de salir
    update public.leagues set owner_id = v_next_owner where id = p_league_id;
  end if;

  delete from public.league_members where league_id = p_league_id and user_id = v_uid;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. RPC: eliminar liga (solo el owner)
-- ----------------------------------------------------------------------------
create or replace function public.delete_league(p_league_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  if not exists (select 1 from public.leagues where id = p_league_id and owner_id = v_uid) then
    raise exception 'Solo el creador puede eliminar la liga';
  end if;
  delete from public.leagues where id = p_league_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. RPC: fijar imagen de liga (solo el owner)
-- ----------------------------------------------------------------------------
create or replace function public.set_league_image(p_league_id uuid, p_image_url text)
returns public.leagues
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_league public.leagues;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  update public.leagues set image_url = p_image_url
  where id = p_league_id and owner_id = v_uid
  returning * into v_league;
  if v_league.id is null then
    raise exception 'Solo el creador puede cambiar la imagen';
  end if;
  return v_league;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. RPC: activar/desactivar el enlace de invitación (solo el owner)
-- ----------------------------------------------------------------------------
create or replace function public.set_invite_active(p_league_id uuid, p_active boolean)
returns public.leagues
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_league public.leagues;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  update public.leagues set invite_active = p_active
  where id = p_league_id and owner_id = v_uid
  returning * into v_league;
  if v_league.id is null then
    raise exception 'Solo el creador puede cambiar el enlace';
  end if;
  return v_league;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. RPC: leer una liga por su código de invitación (lectura pública mínima)
--    Permite a un no-miembro ver nombre + imagen antes de unirse (sin saltarse
--    el RLS de la tabla, porque devuelve solo campos no sensibles).
-- ----------------------------------------------------------------------------
create or replace function public.get_league_by_invite(p_invite_code text)
returns table (id uuid, name text, image_url text, invite_active boolean, members int)
language sql
security definer set search_path = public
stable
as $$
  select l.id, l.name, l.image_url, l.invite_active,
         (select count(*)::int from public.league_members m where m.league_id = l.id)
  from public.leagues l
  where l.invite_code = upper(trim(p_invite_code));
$$;

-- ----------------------------------------------------------------------------
-- 7. join_league: respeta el flag invite_active
-- ----------------------------------------------------------------------------
create or replace function public.join_league(p_invite_code text)
returns public.leagues
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_league public.leagues;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;

  select * into v_league from public.leagues
  where invite_code = upper(trim(p_invite_code));

  if v_league.id is null then raise exception 'Código de liga no válido'; end if;

  -- Ya miembro -> idempotente (aunque el enlace esté desactivado)
  if exists (select 1 from public.league_members
             where league_id = v_league.id and user_id = v_uid) then
    return v_league;
  end if;

  if not v_league.invite_active then
    raise exception 'El enlace de invitación de esta liga está desactivado';
  end if;

  insert into public.league_members (league_id, user_id, balance)
  values (v_league.id, v_uid, v_league.starting_chips);

  insert into public.transactions (league_id, user_id, type, amount, balance_after)
  values (v_league.id, v_uid, 'initial', v_league.starting_chips, v_league.starting_chips);

  return v_league;
end;
$$;

-- ----------------------------------------------------------------------------
-- 8. Permisos
-- ----------------------------------------------------------------------------
grant execute on function public.leave_league(uuid)            to authenticated;
grant execute on function public.delete_league(uuid)           to authenticated;
grant execute on function public.set_league_image(uuid, text)  to authenticated;
grant execute on function public.set_invite_active(uuid, boolean) to authenticated;
-- Lectura por código: también anónimos (para abrir el enlace sin sesión)
grant execute on function public.get_league_by_invite(text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 9. Storage de imágenes de liga (bucket público; escribe solo el owner)
--    Convención de ruta: league-images/<league_id>/...
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('league-images', 'league-images', true)
on conflict (id) do nothing;

drop policy if exists "league-images public read" on storage.objects;
create policy "league-images public read" on storage.objects
  for select using (bucket_id = 'league-images');

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
