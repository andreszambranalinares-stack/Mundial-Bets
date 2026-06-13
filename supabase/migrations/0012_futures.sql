-- ============================================================================
-- B2 — Apuestas de futuro: ¿quién gana el Mundial?
-- Cada miembro elige UNA vez por liga (cuota fija del catálogo). La liquida el
-- owner cuando se conoce el campeón. Tabla ligera propia (no toca bets/bet_legs)
-- que reutiliza la economía de fichas (transactions 'stake'/'payout').
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Catálogo de cuotas de futuro (fuente de la verdad)
-- ----------------------------------------------------------------------------
create table if not exists public.future_odds (
  id        bigserial primary key,
  market    text not null default 'champion',
  selection text not null,            -- clave estable (= equipo)
  label     text not null,            -- texto mostrado
  price     numeric(8,3) not null,
  sort      int not null default 0,
  unique (market, selection)
);

alter table public.future_odds enable row level security;
drop policy if exists "future_odds select" on public.future_odds;
create policy "future_odds select" on public.future_odds
  for select to authenticated using (true);

insert into public.future_odds (market, selection, label, price, sort) values
  ('champion','Argentina','Argentina',5.5,1),
  ('champion','Francia','Francia',6.0,2),
  ('champion','Brasil','Brasil',6.5,3),
  ('champion','España','España',8.0,4),
  ('champion','Inglaterra','Inglaterra',8.5,5),
  ('champion','Alemania','Alemania',10.0,6),
  ('champion','Portugal','Portugal',11.0,7),
  ('champion','Países Bajos','Países Bajos',13.0,8),
  ('champion','Bélgica','Bélgica',17.0,9),
  ('champion','Uruguay','Uruguay',21.0,10),
  ('champion','Croacia','Croacia',26.0,11),
  ('champion','Estados Unidos','Estados Unidos',26.0,12),
  ('champion','México','México',41.0,13),
  ('champion','Colombia','Colombia',41.0,14),
  ('champion','Marruecos','Marruecos',51.0,15),
  ('champion','Otro','Otro equipo',9.0,99)
on conflict (market, selection) do nothing;

-- ----------------------------------------------------------------------------
-- 2. Apuestas de futuro (una por miembro/liga/mercado)
-- ----------------------------------------------------------------------------
create table if not exists public.futures_bets (
  id         uuid primary key default gen_random_uuid(),
  league_id  uuid not null references public.leagues(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  market     text not null default 'champion',
  selection  text not null,
  label      text not null,
  odds_taken numeric(8,3) not null,
  stake      numeric(14,2) not null check (stake > 0),
  status     text not null default 'pending' check (status in ('pending','won','lost')),
  placed_at  timestamptz not null default now(),
  settled_at timestamptz,
  unique (league_id, user_id, market)
);
create index if not exists futures_bets_idx on public.futures_bets(league_id, market);

alter table public.futures_bets enable row level security;
-- Todos los miembros ven las apuestas de futuro de su liga (parte de la gracia).
drop policy if exists "futures select member" on public.futures_bets;
create policy "futures select member" on public.futures_bets
  for select to authenticated using (public.is_league_member(league_id));

-- ----------------------------------------------------------------------------
-- 3. place_future: elige campeón (descuenta stake; una sola vez por mercado)
-- ----------------------------------------------------------------------------
create or replace function public.place_future(
  p_league_id uuid,
  p_market    text,
  p_selection text,
  p_stake     numeric
)
returns public.futures_bets
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_balance numeric;
  v_odd     public.future_odds;
  v_bet     public.futures_bets;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  if p_stake is null or p_stake <= 0 then raise exception 'La apuesta debe ser mayor que 0'; end if;

  select * into v_odd from public.future_odds where market = p_market and selection = p_selection;
  if v_odd.id is null then raise exception 'Selección no válida'; end if;

  select balance into v_balance from public.league_members
  where league_id = p_league_id and user_id = v_uid
  for update;
  if v_balance is null then raise exception 'No perteneces a esta liga'; end if;
  if v_balance < p_stake then
    raise exception 'Fichas insuficientes (tienes %, apuestas %)', v_balance, p_stake;
  end if;
  if exists (select 1 from public.futures_bets where league_id = p_league_id and user_id = v_uid and market = p_market) then
    raise exception 'Ya tienes una apuesta de futuro para este mercado';
  end if;

  insert into public.futures_bets (league_id, user_id, market, selection, label, odds_taken, stake)
  values (p_league_id, v_uid, p_market, p_selection, v_odd.label, v_odd.price, p_stake)
  returning * into v_bet;

  update public.league_members set balance = balance - p_stake
  where league_id = p_league_id and user_id = v_uid;
  insert into public.transactions (league_id, user_id, bet_id, type, amount, balance_after)
  values (p_league_id, v_uid, null, 'stake', -p_stake, v_balance - p_stake);

  return v_bet;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. settle_future (solo owner): fija el ganador y paga
-- ----------------------------------------------------------------------------
create or replace function public.settle_future(
  p_league_id uuid,
  p_market    text,
  p_winner    text
)
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  r             record;
  v_payout      numeric;
  v_new_balance numeric;
  v_count       int := 0;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  if not exists (select 1 from public.leagues where id = p_league_id and owner_id = v_uid) then
    raise exception 'Solo el creador de la liga puede liquidar apuestas de futuro';
  end if;

  for r in
    select * from public.futures_bets
    where league_id = p_league_id and market = p_market and status = 'pending'
    for update
  loop
    if r.selection = p_winner then
      v_payout := round(r.stake * r.odds_taken, 2);
      update public.league_members set balance = balance + v_payout
      where league_id = r.league_id and user_id = r.user_id
      returning balance into v_new_balance;
      insert into public.transactions (league_id, user_id, bet_id, type, amount, balance_after)
      values (r.league_id, r.user_id, null, 'payout', v_payout, v_new_balance);
      update public.futures_bets set status = 'won', settled_at = now() where id = r.id;
    else
      update public.futures_bets set status = 'lost', settled_at = now() where id = r.id;
    end if;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. Realtime + permisos
-- ----------------------------------------------------------------------------
alter publication supabase_realtime add table public.futures_bets;

grant execute on function public.place_future(uuid, text, text, numeric) to authenticated;
grant execute on function public.settle_future(uuid, text, text) to authenticated;
