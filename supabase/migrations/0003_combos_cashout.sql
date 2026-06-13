-- ============================================================================
-- Mundial Bets — Combinadas (parlays) + Cash-out (retirar apuesta)
-- ----------------------------------------------------------------------------
-- Una apuesta (bets) pasa a ser un "boleto": un stake, una cuota combinada y un
-- estado. Las selecciones viven en bet_legs (1 pata = simple, 2+ = combinada).
-- El cash-out en vivo se valora en la edge function (necesita marcador del
-- momento); aquí solo está apply_cashout(), que aplica el valor de forma atómica.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tabla de patas (cada selección de un boleto)
-- ----------------------------------------------------------------------------
create table if not exists public.bet_legs (
  id          bigserial primary key,
  bet_id      uuid not null references public.bets(id) on delete cascade,
  match_id    text not null references public.matches(id),
  market      text not null check (market in ('h2h','totals')),
  selection   text not null check (selection in ('home','draw','away','over','under')),
  point       numeric(6,2) not null default 0,
  odds_taken  numeric(8,3) not null,
  status      text not null default 'pending' check (status in ('pending','won','lost','void')),
  settled_at  timestamptz
);
create index if not exists bet_legs_bet_idx on public.bet_legs(bet_id);
create index if not exists bet_legs_match_idx on public.bet_legs(match_id) where status = 'pending';

-- ----------------------------------------------------------------------------
-- 2. Ajustes en bets: ahora es la cabecera del boleto
-- ----------------------------------------------------------------------------
alter table public.bets add column if not exists num_legs       int;
alter table public.bets add column if not exists combined_odds  numeric(12,3);
alter table public.bets add column if not exists cashout_value  numeric(14,2);
alter table public.bets add column if not exists settled_payout numeric(14,2);

-- Las columnas de "simple" pasan a ser opcionales (en combinada no aplican)
alter table public.bets alter column match_id   drop not null;
alter table public.bets alter column market     drop not null;
alter table public.bets alter column selection  drop not null;
alter table public.bets alter column odds_taken drop not null;

-- Nuevo estado: 'cashed_out' (retirada)
alter table public.bets drop constraint if exists bets_status_check;
alter table public.bets add constraint bets_status_check
  check (status in ('pending','won','lost','void','cashed_out'));

-- Nuevo tipo de movimiento en el ledger: 'cashout'
alter table public.transactions drop constraint if exists transactions_type_check;
alter table public.transactions add constraint transactions_type_check
  check (type in ('initial','stake','payout','refund','cashout'));

-- Caché del marcador en vivo (para no repetir llamadas a la API en cada retirada)
alter table public.matches add column if not exists scores_updated_at timestamptz;

-- ----------------------------------------------------------------------------
-- 3. Migrar apuestas simples existentes a una pata cada una
-- ----------------------------------------------------------------------------
insert into public.bet_legs (bet_id, match_id, market, selection, point, odds_taken, status, settled_at)
select id, match_id, market, selection, point, odds_taken, status, settled_at
from public.bets b
where b.match_id is not null
  and not exists (select 1 from public.bet_legs l where l.bet_id = b.id);

update public.bets
set combined_odds = coalesce(combined_odds, odds_taken),
    num_legs      = coalesce(num_legs, 1)
where num_legs is null;

-- ----------------------------------------------------------------------------
-- 4. RLS de bet_legs: ves las patas de los boletos de tus ligas
-- ----------------------------------------------------------------------------
alter table public.bet_legs enable row level security;
drop policy if exists bet_legs_select on public.bet_legs;
create policy bet_legs_select on public.bet_legs
  for select using (
    exists (
      select 1 from public.bets b
      where b.id = bet_legs.bet_id and public.is_league_member(b.league_id)
    )
  );

-- Realtime para refrescar Mis Apuestas al liquidar/retirar
alter publication supabase_realtime add table public.bet_legs;

-- ----------------------------------------------------------------------------
-- 5. place_combo_bet: crea un boleto con 1..N patas (simple o combinada)
--    p_legs = jsonb array de {match_id, market, selection, point}
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

  -- Bloquea el saldo (anti condiciones de carrera)
  select balance into v_balance from public.league_members
  where league_id = p_league_id and user_id = v_uid
  for update;
  if v_balance is null then raise exception 'No perteneces a esta liga'; end if;
  if v_balance < p_stake then
    raise exception 'Fichas insuficientes (tienes %, apuestas %)', v_balance, p_stake;
  end if;

  -- Cabecera del boleto (para tener el id al insertar las patas)
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

  -- Descuenta el stake
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

  return v_bet;
end;
$$;

-- Compatibilidad: place_bet (simple) ahora delega en place_combo_bet
create or replace function public.place_bet(
  p_league_id uuid,
  p_match_id  text,
  p_market    text,
  p_selection text,
  p_point     numeric,
  p_stake     numeric
)
returns public.bets
language plpgsql
security definer set search_path = public
as $$
begin
  return public.place_combo_bet(
    p_league_id,
    p_stake,
    jsonb_build_array(jsonb_build_object(
      'match_id', p_match_id,
      'market', p_market,
      'selection', p_selection,
      'point', coalesce(p_point, 0)
    ))
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. settle_ticket: decide un boleto cuando todas sus patas están resueltas
--    (gana = todas las patas no-void ganadas; void reduce la cuota efectiva)
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

  -- Una sola pata perdida tumba toda la combinada
  if v_lost > 0 then
    update public.bets set status = 'lost', settled_at = now(), settled_payout = 0 where id = p_bet_id;
    return;
  end if;

  -- Aún quedan patas por resolver
  if v_pending > 0 then return; end if;

  -- Todas las patas ganadas o anuladas
  if v_won = 0 then
    -- Todas anuladas -> devolución del stake
    update public.league_members set balance = balance + v_bet.stake
      where league_id = v_bet.league_id and user_id = v_bet.user_id
      returning balance into v_new_balance;
    update public.bets set status = 'void', settled_at = now(), settled_payout = v_bet.stake where id = p_bet_id;
    insert into public.transactions (league_id, user_id, bet_id, type, amount, balance_after)
    values (v_bet.league_id, v_bet.user_id, p_bet_id, 'refund', v_bet.stake, v_new_balance);
    return;
  end if;

  -- Cuota efectiva = producto de las cuotas de las patas ganadas (void cuenta como 1)
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
end;
$$;

-- ----------------------------------------------------------------------------
-- 7. settle_match (reescrito): resuelve las patas de un partido y re-evalúa boletos
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

  -- Resolver cada pata pendiente de este partido
  for r in select * from public.bet_legs where match_id = p_match_id and status = 'pending' for update loop
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

  -- Re-evaluar los boletos afectados
  for r in select distinct bet_id from public.bet_legs where match_id = p_match_id loop
    perform public.settle_ticket(r.bet_id);
  end loop;

  update public.matches set status = 'finished' where id = p_match_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 8. apply_cashout: aplica el valor de retirada de forma atómica.
--    El VALOR lo calcula la edge function (con el marcador en vivo); aquí solo
--    se acredita, se marca el boleto como retirado y se cierran las patas.
--    Solo ejecutable por service_role (la edge function), nunca por el cliente.
-- ----------------------------------------------------------------------------
create or replace function public.apply_cashout(p_bet_id uuid, p_value numeric)
returns numeric
language plpgsql
security definer set search_path = public
as $$
declare
  v_bet         public.bets;
  v_new_balance numeric;
begin
  select * into v_bet from public.bets where id = p_bet_id for update;
  if v_bet.id is null then raise exception 'Apuesta no encontrada'; end if;
  if v_bet.status <> 'pending' then raise exception 'La apuesta ya no está activa'; end if;
  if p_value is null or p_value < 0 then raise exception 'Valor de retirada inválido'; end if;

  update public.league_members set balance = balance + p_value
    where league_id = v_bet.league_id and user_id = v_bet.user_id
    returning balance into v_new_balance;

  update public.bets
    set status = 'cashed_out', settled_at = now(), cashout_value = p_value, settled_payout = p_value
  where id = p_bet_id;

  -- Cierra las patas pendientes para que la liquidación posterior las ignore
  update public.bet_legs set status = 'void', settled_at = now()
  where bet_id = p_bet_id and status = 'pending';

  insert into public.transactions (league_id, user_id, bet_id, type, amount, balance_after)
  values (v_bet.league_id, v_bet.user_id, p_bet_id, 'cashout', p_value, v_new_balance);

  return v_new_balance;
end;
$$;

-- ----------------------------------------------------------------------------
-- 9. Permisos
-- ----------------------------------------------------------------------------
grant execute on function public.place_combo_bet(uuid, numeric, jsonb) to authenticated;

-- Funciones internas / de servidor: que NO las pueda llamar el cliente
revoke all on function public.settle_match(text)            from public;
revoke all on function public.settle_ticket(uuid)           from public;
revoke all on function public.apply_cashout(uuid, numeric)  from public;
grant execute on function public.settle_match(text)           to service_role;
grant execute on function public.settle_ticket(uuid)          to service_role;
grant execute on function public.apply_cashout(uuid, numeric) to service_role;
