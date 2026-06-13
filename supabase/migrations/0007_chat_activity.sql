-- ============================================================================
-- Fase 4 — Chat de liga (texto) + Muro de actividad, en tiempo real
-- Dos tablas nuevas con RLS por liga y Realtime. Se registran eventos de
-- actividad desde las funciones existentes (unirse, apostar, liquidar).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Mensajes de chat (uno por liga, solo miembros)
-- ----------------------------------------------------------------------------
create table if not exists public.league_messages (
  id         bigserial primary key,
  league_id  uuid not null references public.leagues(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  content    text not null check (char_length(content) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists league_messages_idx on public.league_messages(league_id, created_at);

alter table public.league_messages enable row level security;

-- Ver: solo miembros de la liga
drop policy if exists "messages select member" on public.league_messages;
create policy "messages select member" on public.league_messages
  for select to authenticated using (public.is_league_member(league_id));

-- Escribir: solo miembros, y solo en tu propio nombre
drop policy if exists "messages insert member" on public.league_messages;
create policy "messages insert member" on public.league_messages
  for insert to authenticated
  with check (public.is_league_member(league_id) and user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 2. Muro de actividad (eventos de la liga)
-- ----------------------------------------------------------------------------
create table if not exists public.league_activity (
  id         bigserial primary key,
  league_id  uuid not null references public.leagues(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  type       text not null check (type in ('member_joined','bet_placed','bet_won','bet_lost')),
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists league_activity_idx on public.league_activity(league_id, created_at);

alter table public.league_activity enable row level security;

-- Ver: solo miembros de la liga (la escritura va por funciones SECURITY DEFINER)
drop policy if exists "activity select member" on public.league_activity;
create policy "activity select member" on public.league_activity
  for select to authenticated using (public.is_league_member(league_id));

-- ----------------------------------------------------------------------------
-- 3. Helper para registrar actividad
-- ----------------------------------------------------------------------------
create or replace function public.log_activity(
  p_league_id uuid, p_user_id uuid, p_type text, p_payload jsonb default '{}'::jsonb
)
returns void
language sql
security definer set search_path = public
as $$
  insert into public.league_activity (league_id, user_id, type, payload)
  values (p_league_id, p_user_id, p_type, coalesce(p_payload, '{}'::jsonb));
$$;

-- ----------------------------------------------------------------------------
-- 4. Realtime
-- ----------------------------------------------------------------------------
alter publication supabase_realtime add table public.league_messages;
alter publication supabase_realtime add table public.league_activity;

-- ----------------------------------------------------------------------------
-- 5. join_league: registra "se unió" (reemplaza la versión de 0006 + actividad)
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

  perform public.log_activity(v_league.id, v_uid, 'member_joined');

  return v_league;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. place_combo_bet: registra "hizo una apuesta" (reemplaza 0003 + actividad)
-- ----------------------------------------------------------------------------
create or replace function public.place_combo_bet(
  p_league_id uuid,
  p_stake     numeric,
  p_legs      jsonb
)
returns public.bets
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_balance  numeric;
  v_leg      jsonb;
  v_match    public.matches;
  v_price    numeric;
  v_combined numeric := 1;
  v_count    int := 0;
  v_seen     text[] := array[]::text[];
  v_payout   numeric;
  v_bet      public.bets;
  v_mid      text;
  v_market   text;
  v_selection text;
  v_point    numeric;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  if p_stake is null or p_stake <= 0 then raise exception 'La apuesta debe ser mayor que 0'; end if;
  if p_legs is null or jsonb_array_length(p_legs) = 0 then
    raise exception 'La apuesta no tiene selecciones';
  end if;

  select balance into v_balance from public.league_members
  where league_id = p_league_id and user_id = v_uid
  for update;
  if v_balance is null then raise exception 'No perteneces a esta liga'; end if;
  if v_balance < p_stake then
    raise exception 'Fichas insuficientes (tienes %, apuestas %)', v_balance, p_stake;
  end if;

  insert into public.bets (league_id, user_id, stake, potential_payout, combined_odds, num_legs, status)
  values (p_league_id, v_uid, p_stake, 0, 1, 0, 'pending')
  returning * into v_bet;

  for v_leg in select * from jsonb_array_elements(p_legs) loop
    v_mid       := v_leg->>'match_id';
    v_market    := v_leg->>'market';
    v_selection := v_leg->>'selection';
    v_point     := coalesce((v_leg->>'point')::numeric, 0);

    if v_mid = any(v_seen) then
      raise exception 'No puedes combinar dos selecciones del mismo partido';
    end if;
    v_seen := array_append(v_seen, v_mid);

    select * into v_match from public.matches where id = v_mid;
    if v_match.id is null then raise exception 'Partido no encontrado'; end if;
    if v_match.status <> 'scheduled' or v_match.commence_time <= now() then
      raise exception 'El partido % ya ha empezado o finalizado',
        v_match.home_team || ' vs ' || v_match.away_team;
    end if;

    select price into v_price from public.match_odds
    where match_id = v_mid and market = v_market
      and selection = v_selection and point = v_point;
    if v_price is null then raise exception 'No hay cuota disponible para una selección'; end if;

    insert into public.bet_legs (bet_id, match_id, market, selection, point, odds_taken)
    values (v_bet.id, v_mid, v_market, v_selection, v_point, v_price);

    v_combined := v_combined * v_price;
    v_count    := v_count + 1;
  end loop;

  v_payout := round(p_stake * v_combined, 2);

  update public.league_members set balance = balance - p_stake
  where league_id = p_league_id and user_id = v_uid;

  update public.bets
    set combined_odds    = round(v_combined, 3),
        num_legs         = v_count,
        potential_payout = v_payout
  where id = v_bet.id
  returning * into v_bet;

  insert into public.transactions (league_id, user_id, bet_id, type, amount, balance_after)
  values (p_league_id, v_uid, v_bet.id, 'stake', -p_stake, v_balance - p_stake);

  -- Actividad (sin revelar las selecciones exactas; solo nº de patas y stake)
  perform public.log_activity(p_league_id, v_uid, 'bet_placed',
    jsonb_build_object('num_legs', v_count, 'stake', p_stake));

  return v_bet;
end;
$$;

-- ----------------------------------------------------------------------------
-- 7. settle_ticket: registra "ganó"/"falló" (reemplaza 0003 + actividad)
-- ----------------------------------------------------------------------------
create or replace function public.settle_ticket(p_bet_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_bet         public.bets;
  v_lost        int;
  v_pending     int;
  v_won         int;
  v_mult        numeric;
  v_payout      numeric;
  v_new_balance numeric;
begin
  select * into v_bet from public.bets where id = p_bet_id for update;
  if v_bet.id is null or v_bet.status <> 'pending' then return; end if;

  select count(*) filter (where status = 'lost'),
         count(*) filter (where status = 'pending'),
         count(*) filter (where status = 'won')
    into v_lost, v_pending, v_won
  from public.bet_legs where bet_id = p_bet_id;

  if v_lost > 0 then
    update public.bets set status = 'lost', settled_at = now(), settled_payout = 0 where id = p_bet_id;
    perform public.log_activity(v_bet.league_id, v_bet.user_id, 'bet_lost',
      jsonb_build_object('stake', v_bet.stake));
    return;
  end if;

  if v_pending > 0 then return; end if;

  if v_won = 0 then
    update public.league_members set balance = balance + v_bet.stake
      where league_id = v_bet.league_id and user_id = v_bet.user_id
      returning balance into v_new_balance;
    update public.bets set status = 'void', settled_at = now(), settled_payout = v_bet.stake where id = p_bet_id;
    insert into public.transactions (league_id, user_id, bet_id, type, amount, balance_after)
    values (v_bet.league_id, v_bet.user_id, p_bet_id, 'refund', v_bet.stake, v_new_balance);
    return;
  end if;

  select coalesce(exp(sum(ln(odds_taken))), 1) into v_mult
  from public.bet_legs where bet_id = p_bet_id and status = 'won';
  v_payout := round(v_bet.stake * v_mult, 2);

  update public.league_members set balance = balance + v_payout
    where league_id = v_bet.league_id and user_id = v_bet.user_id
    returning balance into v_new_balance;
  update public.bets
    set status = 'won', settled_at = now(), settled_payout = v_payout, combined_odds = round(v_mult, 3)
  where id = p_bet_id;
  insert into public.transactions (league_id, user_id, bet_id, type, amount, balance_after)
  values (v_bet.league_id, v_bet.user_id, p_bet_id, 'payout', v_payout, v_new_balance);

  perform public.log_activity(v_bet.league_id, v_bet.user_id, 'bet_won',
    jsonb_build_object('payout', v_payout));
end;
$$;

-- log_activity solo la usan funciones internas; revócala del cliente.
revoke all on function public.log_activity(uuid, uuid, text, jsonb) from public;
