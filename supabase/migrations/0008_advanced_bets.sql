-- ============================================================================
-- Fase 5 — Func 2: Apuestas avanzadas (tipo Bet365) con cuotas fijas y
-- liquidación MANUAL por el creador de la liga.
-- Se integran en el modelo existente de boletos (bets + bet_legs): un mercado
-- avanzado es una pata más, con cuota fija servida desde advanced_odds.
-- La liquidación automática por marcador IGNORA las patas avanzadas; las
-- resuelve el owner con settle_advanced().
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. bet_legs: admitir mercados avanzados
-- ----------------------------------------------------------------------------
alter table public.bet_legs drop constraint if exists bet_legs_market_check;
alter table public.bet_legs drop constraint if exists bet_legs_selection_check;
alter table public.bet_legs add column if not exists label       text;
alter table public.bet_legs add column if not exists player_name text;

-- ----------------------------------------------------------------------------
-- 2. Catálogo de mercados avanzados con cuotas fijas (fuente de la verdad)
-- ----------------------------------------------------------------------------
create table if not exists public.advanced_odds (
  id           bigserial primary key,
  category     text not null,             -- Goles, Tarjetas, Jugadores, Tiros, Córners, Porteros
  market       text not null,
  selection    text not null,
  label        text not null,             -- texto mostrado (Local/Visitante se sustituye en el cliente)
  needs_player boolean not null default false,
  price        numeric(8,3) not null,
  sort         int not null default 0,
  unique (market, selection)
);

alter table public.advanced_odds enable row level security;
drop policy if exists "advanced_odds select" on public.advanced_odds;
create policy "advanced_odds select" on public.advanced_odds
  for select to authenticated using (true);

insert into public.advanced_odds (category, market, selection, label, needs_player, price, sort) values
  -- Goles
  ('Goles','goals_over','o0_5','Más de 0.5 goles',false,1.05,10),
  ('Goles','goals_over','o1_5','Más de 1.5 goles',false,1.40,11),
  ('Goles','goals_over','o2_5','Más de 2.5 goles',false,2.10,12),
  ('Goles','goals_over','o3_5','Más de 3.5 goles',false,3.50,13),
  ('Goles','first_goal','home','Marca primero: Local',false,2.10,14),
  ('Goles','first_goal','away','Marca primero: Visitante',false,2.30,15),
  ('Goles','last_goal','home','Último en marcar: Local',false,2.20,16),
  ('Goles','last_goal','away','Último en marcar: Visitante',false,2.40,17),
  ('Goles','btts','yes','Ambos equipos marcan: Sí',false,1.80,18),
  ('Goles','btts','no','Ambos equipos marcan: No',false,1.90,19),
  -- Tarjetas
  ('Tarjetas','cards_over','o1_5','Más de 1.5 tarjetas',false,1.30,20),
  ('Tarjetas','cards_over','o2_5','Más de 2.5 tarjetas',false,1.70,21),
  ('Tarjetas','cards_over','o3_5','Más de 3.5 tarjetas',false,2.40,22),
  ('Tarjetas','cards_over','o4_5','Más de 4.5 tarjetas',false,3.50,23),
  ('Tarjetas','player_card','yellow','recibirá amarilla',true,2.50,24),
  ('Tarjetas','player_card','red','recibirá roja',true,8.00,25),
  -- Jugadores
  ('Jugadores','player_goal','yes','marcará gol',true,3.00,30),
  ('Jugadores','player_assist','yes','dará asistencia',true,3.50,31),
  ('Jugadores','player_anycard','yes','recibirá tarjeta',true,3.00,32),
  ('Jugadores','player_minutes','0_45','jugará 0-45 min',true,3.00,33),
  ('Jugadores','player_minutes','46_90','jugará 46-90 min',true,1.50,34),
  ('Jugadores','player_minutes','dnp','no jugará',true,5.00,35),
  -- Tiros a puerta
  ('Tiros','shots_over','o2_5','Más de 2.5 tiros a puerta',false,1.40,40),
  ('Tiros','shots_over','o3_5','Más de 3.5 tiros a puerta',false,1.80,41),
  ('Tiros','shots_over','o5_5','Más de 5.5 tiros a puerta',false,2.80,42),
  ('Tiros','player_shot','yes','disparará a puerta',true,1.80,43),
  -- Córners
  ('Córners','corners_over','o5_5','Más de 5.5 córners',false,1.40,50),
  ('Córners','corners_over','o7_5','Más de 7.5 córners',false,1.90,51),
  ('Córners','corners_over','o9_5','Más de 9.5 córners',false,3.00,52),
  -- Porteros
  ('Porteros','clean_sheet','home','Portería a cero: Local',false,2.20,60),
  ('Porteros','clean_sheet','away','Portería a cero: Visitante',false,2.40,61),
  ('Porteros','keeper_saves','1_3','hará 1-3 paradas',true,2.20,62),
  ('Porteros','keeper_saves','4_6','hará 4-6 paradas',true,2.50,63),
  ('Porteros','keeper_saves','6plus','hará más de 6 paradas',true,3.50,64)
on conflict (market, selection) do nothing;

-- ----------------------------------------------------------------------------
-- 3. place_combo_bet: ahora también acepta patas avanzadas
--    (si market no es h2h/totals, la cuota sale de advanced_odds)
--    Reemplaza la versión de 0007 conservando el registro de actividad.
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
  v_player   text;
  v_label    text;
  v_adv      public.advanced_odds;
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
    v_player    := nullif(trim(coalesce(v_leg->>'player_name','')), '');
    v_label     := null;

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

    if v_market in ('h2h','totals') then
      select price into v_price from public.match_odds
      where match_id = v_mid and market = v_market
        and selection = v_selection and point = v_point;
      if v_price is null then raise exception 'No hay cuota disponible para una selección'; end if;
    else
      -- Mercado avanzado: cuota fija del catálogo
      select * into v_adv from public.advanced_odds
      where market = v_market and selection = v_selection;
      if v_adv.id is null then raise exception 'Mercado avanzado no válido'; end if;
      if v_adv.needs_player and v_player is null then
        raise exception 'Debes indicar el jugador para esa apuesta';
      end if;
      v_price := v_adv.price;
      v_label := v_adv.label;
    end if;

    insert into public.bet_legs (bet_id, match_id, market, selection, point, odds_taken, label, player_name)
    values (v_bet.id, v_mid, v_market, v_selection, v_point, v_price, v_label, v_player);

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

  perform public.log_activity(p_league_id, v_uid, 'bet_placed',
    jsonb_build_object('num_legs', v_count, 'stake', p_stake));

  return v_bet;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. settle_match: la liquidación por marcador IGNORA las patas avanzadas
--    (reemplaza la versión de 0003; el resto de la lógica es idéntica).
-- ----------------------------------------------------------------------------
create or replace function public.settle_match(p_match_id text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_match public.matches;
  r       record;
  v_total int;
  v_win   boolean;
  v_push  boolean;
begin
  select * into v_match from public.matches where id = p_match_id;
  if v_match.id is null or v_match.home_score is null or v_match.away_score is null then
    raise exception 'Partido sin resultado para liquidar';
  end if;
  v_total := v_match.home_score + v_match.away_score;

  -- Solo mercados estándar (1X2 y over/under). Las avanzadas las liquida el owner.
  for r in
    select * from public.bet_legs
    where match_id = p_match_id and status = 'pending' and market in ('h2h','totals')
    for update
  loop
    v_win := false; v_push := false;
    if r.market = 'h2h' then
      if r.selection = 'home' then v_win := v_match.home_score > v_match.away_score;
      elsif r.selection = 'away' then v_win := v_match.away_score > v_match.home_score;
      elsif r.selection = 'draw' then v_win := v_match.home_score = v_match.away_score; end if;
    elsif r.market = 'totals' then
      if v_total = r.point then v_push := true;
      elsif r.selection = 'over' then v_win := v_total > r.point;
      elsif r.selection = 'under' then v_win := v_total < r.point; end if;
    end if;

    update public.bet_legs
      set status = case when v_push then 'void' when v_win then 'won' else 'lost' end,
          settled_at = now()
    where id = r.id;
  end loop;

  -- Re-evaluar boletos (los que aún tengan patas avanzadas pendientes esperan)
  for r in select distinct bet_id from public.bet_legs where match_id = p_match_id loop
    perform public.settle_ticket(r.bet_id);
  end loop;

  update public.matches set status = 'finished' where id = p_match_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. settle_advanced: el creador de la liga resuelve a mano un mercado avanzado.
--    Resuelve TODAS las patas de su liga que coincidan (mercado/selección/jugador)
--    y re-evalúa los boletos afectados.
-- ----------------------------------------------------------------------------
create or replace function public.settle_advanced(
  p_league_id   uuid,
  p_match_id    text,
  p_market      text,
  p_selection   text,
  p_player_name text,
  p_result      text       -- 'won' | 'lost' | 'void'
)
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  r       record;
  v_count int := 0;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  if not exists (select 1 from public.leagues where id = p_league_id and owner_id = v_uid) then
    raise exception 'Solo el creador de la liga puede liquidar apuestas avanzadas';
  end if;
  if p_result not in ('won','lost','void') then raise exception 'Resultado no válido'; end if;

  for r in
    select bl.id, bl.bet_id
    from public.bet_legs bl
    join public.bets b on b.id = bl.bet_id
    where b.league_id = p_league_id
      and bl.match_id = p_match_id
      and bl.market = p_market
      and bl.selection = p_selection
      and coalesce(bl.player_name,'') = coalesce(nullif(trim(coalesce(p_player_name,'')),''),'')
      and bl.status = 'pending'
    for update
  loop
    update public.bet_legs set status = p_result, settled_at = now() where id = r.id;
    v_count := v_count + 1;
  end loop;

  for r in
    select distinct bl.bet_id
    from public.bet_legs bl
    join public.bets b on b.id = bl.bet_id
    where b.league_id = p_league_id and bl.match_id = p_match_id
      and bl.market = p_market and bl.selection = p_selection
      and coalesce(bl.player_name,'') = coalesce(nullif(trim(coalesce(p_player_name,'')),''),'')
  loop
    perform public.settle_ticket(r.bet_id);
  end loop;

  return v_count;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. Permisos
-- ----------------------------------------------------------------------------
grant execute on function public.settle_advanced(uuid, text, text, text, text, text) to authenticated;
