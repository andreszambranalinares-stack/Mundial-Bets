-- ============================================================================
-- Mundial Bets — esquema inicial
-- Apuestas ficticias (fichas virtuales) para el Mundial, entre amigos.
-- Ledger contable + saldo por liga + lógica server-side anti-trampas.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- TABLAS
-- ----------------------------------------------------------------------------

-- Perfil público, 1:1 con auth.users
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url  text,
  created_at  timestamptz not null default now()
);

-- Ligas (cada una es un "mundo" independiente con su propia economía de fichas)
create table if not exists public.leagues (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  invite_code    text not null unique,
  owner_id       uuid not null references auth.users(id) on delete cascade,
  starting_chips numeric(14,2) not null default 1000,
  created_at     timestamptz not null default now()
);

-- Pertenencia a liga + saldo de fichas (el saldo vive aquí, por jugador y liga)
create table if not exists public.league_members (
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  balance   numeric(14,2) not null default 0,
  joined_at timestamptz not null default now(),
  primary key (league_id, user_id)
);

-- Partidos (espejo de la API de cuotas). id = id del evento en la API.
create table if not exists public.matches (
  id               text primary key,
  sport_key        text,
  home_team        text not null,
  away_team        text not null,
  commence_time    timestamptz not null,
  status           text not null default 'scheduled'
                   check (status in ('scheduled','live','finished')),
  home_score       int,
  away_score       int,
  last_odds_update timestamptz,
  created_at       timestamptz not null default now()
);

-- Cuotas vigentes por mercado/selección. point = línea de over/under (0 para 1X2).
create table if not exists public.match_odds (
  id         bigserial primary key,
  match_id   text not null references public.matches(id) on delete cascade,
  market     text not null check (market in ('h2h','totals')),
  selection  text not null check (selection in ('home','draw','away','over','under')),
  point      numeric(6,2) not null default 0,
  price      numeric(8,3) not null,             -- cuota decimal (ej: 2.10)
  updated_at timestamptz not null default now(),
  unique (match_id, market, selection, point)
);

-- Apuestas. odds_taken bloquea la cuota en el momento de apostar.
create table if not exists public.bets (
  id               uuid primary key default gen_random_uuid(),
  league_id        uuid not null references public.leagues(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  match_id         text not null references public.matches(id),
  market           text not null,
  selection        text not null,
  point            numeric(6,2) not null default 0,
  odds_taken       numeric(8,3) not null,
  stake            numeric(14,2) not null check (stake > 0),
  potential_payout numeric(14,2) not null,
  status           text not null default 'pending'
                   check (status in ('pending','won','lost','void')),
  placed_at        timestamptz not null default now(),
  settled_at       timestamptz
);
create index if not exists bets_league_user_idx on public.bets(league_id, user_id);
create index if not exists bets_match_idx on public.bets(match_id) where status = 'pending';

-- Ledger auditable de movimientos de fichas
create table if not exists public.transactions (
  id            bigserial primary key,
  league_id     uuid not null references public.leagues(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  bet_id        uuid references public.bets(id) on delete set null,
  type          text not null check (type in ('initial','stake','payout','refund')),
  amount        numeric(14,2) not null,          -- + entra, - sale
  balance_after numeric(14,2) not null,
  created_at    timestamptz not null default now()
);
create index if not exists transactions_member_idx on public.transactions(league_id, user_id);

-- ----------------------------------------------------------------------------
-- TRIGGER: crear perfil automáticamente al registrarse
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- HELPER: ¿el usuario actual es miembro de la liga? (evita recursión en RLS)
-- ----------------------------------------------------------------------------
create or replace function public.is_league_member(p_league_id uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.league_members
    where league_id = p_league_id and user_id = auth.uid()
  );
$$;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.leagues        enable row level security;
alter table public.league_members enable row level security;
alter table public.matches        enable row level security;
alter table public.match_odds     enable row level security;
alter table public.bets           enable row level security;
alter table public.transactions   enable row level security;

-- profiles: todos los autenticados pueden ver nombres (para el ranking); editas el tuyo
create policy "profiles select" on public.profiles
  for select to authenticated using (true);
create policy "profiles update own" on public.profiles
  for update to authenticated using (id = auth.uid());

-- leagues: solo ves ligas donde eres miembro (la escritura va por funciones SECURITY DEFINER)
create policy "leagues select member" on public.leagues
  for select to authenticated using (public.is_league_member(id));

-- league_members: ves a todos los miembros de tus ligas (ranking)
create policy "members select same league" on public.league_members
  for select to authenticated using (public.is_league_member(league_id));

-- matches / match_odds: datos globales de solo lectura
create policy "matches select" on public.matches
  for select to authenticated using (true);
create policy "odds select" on public.match_odds
  for select to authenticated using (true);

-- bets: ves las apuestas de tus ligas (feed); la inserción va por place_bet()
create policy "bets select same league" on public.bets
  for select to authenticated using (public.is_league_member(league_id));

-- transactions: solo las tuyas
create policy "transactions select own" on public.transactions
  for select to authenticated using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- FUNCIÓN: generar código de invitación único
-- ----------------------------------------------------------------------------
create or replace function public.gen_invite_code()
returns text
language plpgsql
as $$
declare
  -- Alfabeto sin caracteres ambiguos (sin 0/O, 1/I/L)
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code  text;
  i     int;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;
    exit when not exists (select 1 from public.leagues where invite_code = code);
  end loop;
  return code;
end;
$$;

-- ----------------------------------------------------------------------------
-- FUNCIÓN: crear liga (el creador entra con starting_chips)
-- ----------------------------------------------------------------------------
create or replace function public.create_league(p_name text, p_starting_chips numeric default 1000)
returns public.leagues
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_league public.leagues;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  insert into public.leagues (name, invite_code, owner_id, starting_chips)
  values (trim(p_name), public.gen_invite_code(), v_uid, p_starting_chips)
  returning * into v_league;

  insert into public.league_members (league_id, user_id, balance)
  values (v_league.id, v_uid, v_league.starting_chips);

  insert into public.transactions (league_id, user_id, type, amount, balance_after)
  values (v_league.id, v_uid, 'initial', v_league.starting_chips, v_league.starting_chips);

  return v_league;
end;
$$;

-- ----------------------------------------------------------------------------
-- FUNCIÓN: unirse a liga con código
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
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  select * into v_league from public.leagues
  where invite_code = upper(trim(p_invite_code));

  if v_league.id is null then
    raise exception 'Código de liga no válido';
  end if;

  if exists (select 1 from public.league_members
             where league_id = v_league.id and user_id = v_uid) then
    return v_league; -- ya eres miembro, idempotente
  end if;

  insert into public.league_members (league_id, user_id, balance)
  values (v_league.id, v_uid, v_league.starting_chips);

  insert into public.transactions (league_id, user_id, type, amount, balance_after)
  values (v_league.id, v_uid, 'initial', v_league.starting_chips, v_league.starting_chips);

  return v_league;
end;
$$;

-- ----------------------------------------------------------------------------
-- FUNCIÓN: hacer apuesta (atómica, anti-trampas)
-- ----------------------------------------------------------------------------
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
declare
  v_uid     uuid := auth.uid();
  v_balance numeric;
  v_match   public.matches;
  v_price   numeric;
  v_payout  numeric;
  v_bet     public.bets;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;
  if p_stake is null or p_stake <= 0 then
    raise exception 'La apuesta debe ser mayor que 0';
  end if;

  -- Bloquea la fila de saldo para evitar condiciones de carrera
  select balance into v_balance from public.league_members
  where league_id = p_league_id and user_id = v_uid
  for update;

  if v_balance is null then
    raise exception 'No perteneces a esta liga';
  end if;
  if v_balance < p_stake then
    raise exception 'Fichas insuficientes (tienes %, apuestas %)', v_balance, p_stake;
  end if;

  -- El partido debe existir y no haber empezado
  select * into v_match from public.matches where id = p_match_id;
  if v_match.id is null then
    raise exception 'Partido no encontrado';
  end if;
  if v_match.status <> 'scheduled' or v_match.commence_time <= now() then
    raise exception 'El partido ya ha empezado o finalizado';
  end if;

  -- Cuota vigente para la selección
  select price into v_price from public.match_odds
  where match_id = p_match_id and market = p_market
    and selection = p_selection and point = coalesce(p_point, 0);
  if v_price is null then
    raise exception 'No hay cuota disponible para esa selección';
  end if;

  v_payout := round(p_stake * v_price, 2);

  -- Descuenta saldo
  update public.league_members
  set balance = balance - p_stake
  where league_id = p_league_id and user_id = v_uid;

  -- Crea la apuesta con la cuota bloqueada
  insert into public.bets (league_id, user_id, match_id, market, selection,
                           point, odds_taken, stake, potential_payout)
  values (p_league_id, v_uid, p_match_id, p_market, p_selection,
          coalesce(p_point, 0), v_price, p_stake, v_payout)
  returning * into v_bet;

  insert into public.transactions (league_id, user_id, bet_id, type, amount, balance_after)
  values (p_league_id, v_uid, v_bet.id, 'stake', -p_stake, v_balance - p_stake);

  return v_bet;
end;
$$;

-- ----------------------------------------------------------------------------
-- FUNCIÓN: liquidar un partido (la llama la edge function con service role)
-- Calcula ganadores/perdedores de las apuestas pendientes y paga.
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
  v_new_balance numeric;
begin
  select * into v_match from public.matches where id = p_match_id;
  if v_match.id is null or v_match.home_score is null or v_match.away_score is null then
    raise exception 'Partido sin resultado para liquidar';
  end if;

  v_total := v_match.home_score + v_match.away_score;

  for r in
    select * from public.bets where match_id = p_match_id and status = 'pending' for update
  loop
    v_win  := false;
    v_push := false;

    if r.market = 'h2h' then
      if r.selection = 'home' then
        v_win := v_match.home_score > v_match.away_score;
      elsif r.selection = 'away' then
        v_win := v_match.away_score > v_match.home_score;
      elsif r.selection = 'draw' then
        v_win := v_match.home_score = v_match.away_score;
      end if;
    elsif r.market = 'totals' then
      if v_total = r.point then
        v_push := true;                 -- empate exacto con la línea -> devolución
      elsif r.selection = 'over' then
        v_win := v_total > r.point;
      elsif r.selection = 'under' then
        v_win := v_total < r.point;
      end if;
    end if;

    if v_push then
      -- Devolver el stake
      update public.league_members
      set balance = balance + r.stake
      where league_id = r.league_id and user_id = r.user_id
      returning balance into v_new_balance;

      update public.bets set status = 'void', settled_at = now() where id = r.id;

      insert into public.transactions (league_id, user_id, bet_id, type, amount, balance_after)
      values (r.league_id, r.user_id, r.id, 'refund', r.stake, v_new_balance);

    elsif v_win then
      update public.league_members
      set balance = balance + r.potential_payout
      where league_id = r.league_id and user_id = r.user_id
      returning balance into v_new_balance;

      update public.bets set status = 'won', settled_at = now() where id = r.id;

      insert into public.transactions (league_id, user_id, bet_id, type, amount, balance_after)
      values (r.league_id, r.user_id, r.id, 'payout', r.potential_payout, v_new_balance);

    else
      -- Pierde: el stake ya se descontó al apostar, solo marcamos
      update public.bets set status = 'lost', settled_at = now() where id = r.id;
    end if;
  end loop;

  update public.matches set status = 'finished' where id = p_match_id;
end;
$$;

-- Permisos de ejecución
grant execute on function public.create_league(text, numeric) to authenticated;
grant execute on function public.join_league(text)            to authenticated;
grant execute on function public.place_bet(uuid, text, text, text, numeric, numeric) to authenticated;
-- settle_match la ejecuta el service role (edge function), no los usuarios.
