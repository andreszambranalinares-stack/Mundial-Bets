-- ============================================================================
-- B1 — Quiniela / Pool por jornada
-- El owner abre una quiniela sobre un conjunto de partidos. Cada miembro paga
-- una entrada (va a un bote) y predice el marcador de cada partido. Al liquidar,
-- se puntúa (3 pts marcador exacto, 1 pt acertar el 1X2) y el bote se reparte
-- entre quienes empaten a más puntos.
-- Reutiliza la economía existente: league_members.balance + ledger transactions
-- (type 'stake' al entrar, 'payout' al cobrar) y log_activity.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tablas
-- ----------------------------------------------------------------------------
create table if not exists public.pools (
  id           uuid primary key default gen_random_uuid(),
  league_id    uuid not null references public.leagues(id) on delete cascade,
  name         text not null,
  jornada_date date,
  entry_fee    numeric(14,2) not null check (entry_fee > 0),
  status       text not null default 'open' check (status in ('open','locked','settled')),
  created_by   uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now()
);
create index if not exists pools_league_idx on public.pools(league_id, created_at);

create table if not exists public.pool_matches (
  pool_id  uuid not null references public.pools(id) on delete cascade,
  match_id text not null references public.matches(id) on delete cascade,
  primary key (pool_id, match_id)
);

create table if not exists public.pool_entries (
  id       uuid primary key default gen_random_uuid(),
  pool_id  uuid not null references public.pools(id) on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,
  points   int not null default 0,
  paid_at  timestamptz not null default now(),
  unique (pool_id, user_id)
);
create index if not exists pool_entries_idx on public.pool_entries(pool_id);

create table if not exists public.pool_predictions (
  entry_id  uuid not null references public.pool_entries(id) on delete cascade,
  match_id  text not null references public.matches(id) on delete cascade,
  pred_home int not null default 0 check (pred_home >= 0),
  pred_away int not null default 0 check (pred_away >= 0),
  primary key (entry_id, match_id)
);

-- ----------------------------------------------------------------------------
-- 2. RLS (las escrituras van por funciones SECURITY DEFINER)
-- ----------------------------------------------------------------------------
alter table public.pools            enable row level security;
alter table public.pool_matches     enable row level security;
alter table public.pool_entries     enable row level security;
alter table public.pool_predictions enable row level security;

drop policy if exists "pools select member" on public.pools;
create policy "pools select member" on public.pools
  for select to authenticated using (public.is_league_member(league_id));

drop policy if exists "pool_matches select member" on public.pool_matches;
create policy "pool_matches select member" on public.pool_matches
  for select to authenticated using (
    exists (select 1 from public.pools p where p.id = pool_id and public.is_league_member(p.league_id))
  );

drop policy if exists "pool_entries select member" on public.pool_entries;
create policy "pool_entries select member" on public.pool_entries
  for select to authenticated using (
    exists (select 1 from public.pools p where p.id = pool_id and public.is_league_member(p.league_id))
  );

-- Predicciones: solo ves las tuyas hasta que la quiniela se bloquee/liquide
-- (evita copiar pronósticos antes de que empiece).
drop policy if exists "pool_predictions select" on public.pool_predictions;
create policy "pool_predictions select" on public.pool_predictions
  for select to authenticated using (
    exists (
      select 1 from public.pool_entries e
      join public.pools p on p.id = e.pool_id
      where e.id = entry_id
        and public.is_league_member(p.league_id)
        and (e.user_id = auth.uid() or p.status in ('locked','settled'))
    )
  );

-- ----------------------------------------------------------------------------
-- 3. Tipos de actividad nuevos para el muro
-- ----------------------------------------------------------------------------
alter table public.league_activity drop constraint if exists league_activity_type_check;
alter table public.league_activity add constraint league_activity_type_check
  check (type in ('member_joined','bet_placed','bet_won','bet_lost','pool_joined','pool_settled'));

-- ----------------------------------------------------------------------------
-- 4. Scoring (interno y reutilizable): 3 pts marcador exacto, 1 pt acertar 1X2.
--    Solo cuentan los partidos ya finalizados con marcador.
-- ----------------------------------------------------------------------------
create or replace function public._pool_score(p_pool_id uuid)
returns table (entry_id uuid, user_id uuid, points int)
language sql
security definer set search_path = public
stable
as $$
  select e.id, e.user_id,
    coalesce(sum(
      case
        when m.status = 'finished' and m.home_score is not null and m.away_score is not null then
          case
            when p.pred_home = m.home_score and p.pred_away = m.away_score then 3
            when sign(p.pred_home - p.pred_away) = sign(m.home_score - m.away_score) then 1
            else 0
          end
        else 0
      end
    ), 0)::int
  from public.pool_entries e
  join public.pool_predictions p on p.entry_id = e.id
  join public.matches m on m.id = p.match_id
  where e.pool_id = p_pool_id
  group by e.id, e.user_id;
$$;

-- Resultado/puntuación en vivo para la UI (member-only).
create or replace function public.pool_results(p_pool_id uuid)
returns table (user_id uuid, points int)
language plpgsql
security definer set search_path = public
stable
as $$
declare v_league uuid;
begin
  select league_id into v_league from public.pools where id = p_pool_id;
  if v_league is null or not public.is_league_member(v_league) then
    raise exception 'No autorizado';
  end if;
  return query select s.user_id, s.points from public._pool_score(p_pool_id) s;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. create_pool (solo owner)
-- ----------------------------------------------------------------------------
create or replace function public.create_pool(
  p_league_id    uuid,
  p_name         text,
  p_jornada_date date,
  p_entry_fee    numeric,
  p_match_ids    text[]
)
returns public.pools
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_pool public.pools;
  v_mid  text;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  if not exists (select 1 from public.leagues where id = p_league_id and owner_id = v_uid) then
    raise exception 'Solo el creador de la liga puede crear quinielas';
  end if;
  if p_entry_fee is null or p_entry_fee <= 0 then raise exception 'La entrada debe ser mayor que 0'; end if;
  if p_match_ids is null or array_length(p_match_ids, 1) is null then
    raise exception 'Selecciona al menos un partido';
  end if;

  insert into public.pools (league_id, name, jornada_date, entry_fee, created_by)
  values (p_league_id, trim(p_name), p_jornada_date, p_entry_fee, v_uid)
  returning * into v_pool;

  foreach v_mid in array p_match_ids loop
    if not exists (select 1 from public.matches where id = v_mid) then
      raise exception 'Partido no encontrado: %', v_mid;
    end if;
    insert into public.pool_matches (pool_id, match_id) values (v_pool.id, v_mid)
    on conflict do nothing;
  end loop;

  return v_pool;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. join_pool: paga la entrada y registra predicciones (una por partido)
-- ----------------------------------------------------------------------------
create or replace function public.join_pool(p_pool_id uuid, p_predictions jsonb)
returns public.pool_entries
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_pool    public.pools;
  v_balance numeric;
  v_entry   public.pool_entries;
  v_first   timestamptz;
  v_pred    jsonb;
  v_mid     text;
  v_cnt     int := 0;
  v_total   int;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;

  select * into v_pool from public.pools where id = p_pool_id;
  if v_pool.id is null then raise exception 'Quiniela no encontrada'; end if;
  if v_pool.status <> 'open' then raise exception 'La quiniela ya no admite participantes'; end if;

  select min(m.commence_time) into v_first
  from public.pool_matches pm join public.matches m on m.id = pm.match_id
  where pm.pool_id = p_pool_id;
  if v_first is not null and v_first <= now() then
    raise exception 'La quiniela ya ha comenzado';
  end if;

  select balance into v_balance from public.league_members
  where league_id = v_pool.league_id and user_id = v_uid
  for update;
  if v_balance is null then raise exception 'No perteneces a esta liga'; end if;
  if v_balance < v_pool.entry_fee then
    raise exception 'Fichas insuficientes (tienes %, entrada %)', v_balance, v_pool.entry_fee;
  end if;
  if exists (select 1 from public.pool_entries where pool_id = p_pool_id and user_id = v_uid) then
    raise exception 'Ya participas en esta quiniela';
  end if;

  insert into public.pool_entries (pool_id, user_id) values (p_pool_id, v_uid)
  returning * into v_entry;

  select count(*) into v_total from public.pool_matches where pool_id = p_pool_id;
  for v_pred in select * from jsonb_array_elements(coalesce(p_predictions, '[]'::jsonb)) loop
    v_mid := v_pred->>'match_id';
    if not exists (select 1 from public.pool_matches where pool_id = p_pool_id and match_id = v_mid) then
      raise exception 'Predicción para un partido que no está en la quiniela';
    end if;
    insert into public.pool_predictions (entry_id, match_id, pred_home, pred_away)
    values (v_entry.id, v_mid,
            greatest(0, coalesce((v_pred->>'home')::int, 0)),
            greatest(0, coalesce((v_pred->>'away')::int, 0)))
    on conflict (entry_id, match_id) do update
      set pred_home = excluded.pred_home, pred_away = excluded.pred_away;
    v_cnt := v_cnt + 1;
  end loop;
  if v_cnt <> v_total then
    raise exception 'Debes predecir todos los partidos (% de %)', v_cnt, v_total;
  end if;

  update public.league_members set balance = balance - v_pool.entry_fee
  where league_id = v_pool.league_id and user_id = v_uid;
  insert into public.transactions (league_id, user_id, bet_id, type, amount, balance_after)
  values (v_pool.league_id, v_uid, null, 'stake', -v_pool.entry_fee, v_balance - v_pool.entry_fee);

  perform public.log_activity(v_pool.league_id, v_uid, 'pool_joined',
    jsonb_build_object('name', v_pool.name, 'entry_fee', v_pool.entry_fee));

  return v_entry;
end;
$$;

-- ----------------------------------------------------------------------------
-- 7. lock_pool (solo owner): cierra inscripciones
-- ----------------------------------------------------------------------------
create or replace function public.lock_pool(p_pool_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare v_uid uuid := auth.uid(); v_pool public.pools;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  select * into v_pool from public.pools where id = p_pool_id;
  if v_pool.id is null then raise exception 'Quiniela no encontrada'; end if;
  if not exists (select 1 from public.leagues where id = v_pool.league_id and owner_id = v_uid) then
    raise exception 'Solo el creador de la liga puede bloquear la quiniela';
  end if;
  update public.pools set status = 'locked' where id = p_pool_id and status = 'open';
end;
$$;

-- ----------------------------------------------------------------------------
-- 8. settle_pool (solo owner): puntúa y reparte el bote
-- ----------------------------------------------------------------------------
create or replace function public.settle_pool(p_pool_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_pool        public.pools;
  v_n           int;
  v_pot         numeric;
  v_max         int;
  v_winners     int;
  v_share       numeric;
  v_remainder   numeric;
  v_new_balance numeric;
  v_first       boolean := true;
  r             record;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  select * into v_pool from public.pools where id = p_pool_id for update;
  if v_pool.id is null then raise exception 'Quiniela no encontrada'; end if;
  if not exists (select 1 from public.leagues where id = v_pool.league_id and owner_id = v_uid) then
    raise exception 'Solo el creador de la liga puede liquidar la quiniela';
  end if;
  if v_pool.status = 'settled' then raise exception 'La quiniela ya está liquidada'; end if;

  -- Persistir puntos calculados
  update public.pool_entries e set points = s.points
  from public._pool_score(p_pool_id) s where s.entry_id = e.id;

  select count(*) into v_n from public.pool_entries where pool_id = p_pool_id;
  if v_n = 0 then
    update public.pools set status = 'settled' where id = p_pool_id;
    return;
  end if;

  v_pot := v_pool.entry_fee * v_n;
  select max(points) into v_max from public.pool_entries where pool_id = p_pool_id;
  select count(*) into v_winners from public.pool_entries where pool_id = p_pool_id and points = v_max;

  v_share     := trunc(v_pot / v_winners, 2);
  v_remainder := v_pot - (v_share * v_winners);  -- céntimos sobrantes → primer ganador

  for r in
    select * from public.pool_entries
    where pool_id = p_pool_id and points = v_max
    order by paid_at asc
    for update
  loop
    declare v_amt numeric := v_share + (case when v_first then v_remainder else 0 end);
    begin
      v_first := false;
      update public.league_members set balance = balance + v_amt
      where league_id = v_pool.league_id and user_id = r.user_id
      returning balance into v_new_balance;
      insert into public.transactions (league_id, user_id, bet_id, type, amount, balance_after)
      values (v_pool.league_id, r.user_id, null, 'payout', v_amt, v_new_balance);
    end;
  end loop;

  update public.pools set status = 'settled' where id = p_pool_id;

  perform public.log_activity(v_pool.league_id, v_uid, 'pool_settled',
    jsonb_build_object('name', v_pool.name, 'pot', v_pot, 'winners', v_winners, 'top', v_max));
end;
$$;

-- ----------------------------------------------------------------------------
-- 9. Realtime + permisos
-- ----------------------------------------------------------------------------
alter publication supabase_realtime add table public.pools;
alter publication supabase_realtime add table public.pool_entries;

revoke all on function public._pool_score(uuid) from public;
grant execute on function public.pool_results(uuid) to authenticated;
grant execute on function public.create_pool(uuid, text, date, numeric, text[]) to authenticated;
grant execute on function public.join_pool(uuid, jsonb) to authenticated;
grant execute on function public.lock_pool(uuid) to authenticated;
grant execute on function public.settle_pool(uuid) to authenticated;
