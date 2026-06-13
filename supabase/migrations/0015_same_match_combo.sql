-- ============================================================================
-- 0015_same_match_combo
-- Permite combinar varias selecciones de un MISMO partido en una combinada
-- (p. ej. "gana la selección local" + "más de 2.5 goles"). Antes se rechazaba
-- cualquier combinada con dos patas del mismo partido.
--
-- Se mantiene una única salvaguarda: no se puede repetir la MISMA selección
-- exacta (mismo partido + mercado + selección + línea + jugador) dos veces.
--
-- Reemplaza la versión de 0008 conservando el resto de la lógica intacta.
-- ============================================================================

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
  v_legkey   text;
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

    -- Se permite combinar varias selecciones del mismo partido; solo se
    -- rechaza repetir la selección idéntica (misma pata exacta).
    v_legkey := v_mid || '|' || v_market || '|' || v_selection || '|' ||
                v_point::text || '|' || coalesce(v_player, '');
    if v_legkey = any(v_seen) then
      raise exception 'No puedes repetir la misma selección en la combinada';
    end if;
    v_seen := array_append(v_seen, v_legkey);

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
