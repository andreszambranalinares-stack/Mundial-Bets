-- ============================================================================
-- Cash-out SOLO pre-partido (devolución íntegra), sin edge function.
-- Si ningún partido de la apuesta ha empezado, devuelve el importe completo.
-- Si alguno ya empezó/terminó, no deja retirar (el cash-out en vivo queda
-- pendiente para más adelante, vía la edge function 'cashout').
-- ============================================================================
create or replace function public.cashout_prematch(p_bet_id uuid)
returns numeric
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_bet         public.bets;
  v_started     int;
  v_new_balance numeric;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;

  select * into v_bet from public.bets where id = p_bet_id for update;
  if v_bet.id is null or v_bet.user_id <> v_uid then
    raise exception 'Apuesta no encontrada';
  end if;
  if v_bet.status <> 'pending' then
    raise exception 'La apuesta ya no está activa';
  end if;

  -- ¿Alguna pata con su partido ya empezado o no programado?
  select count(*) into v_started
  from public.bet_legs l
  join public.matches m on m.id = l.match_id
  where l.bet_id = p_bet_id
    and (m.commence_time <= now() or m.status <> 'scheduled');

  if v_started > 0 then
    raise exception 'No se puede retirar: algún partido ya ha empezado';
  end if;

  -- Devolución íntegra del stake
  update public.league_members set balance = balance + v_bet.stake
    where league_id = v_bet.league_id and user_id = v_uid
    returning balance into v_new_balance;

  update public.bets
    set status = 'cashed_out', settled_at = now(),
        cashout_value = v_bet.stake, settled_payout = v_bet.stake
  where id = p_bet_id;

  update public.bet_legs set status = 'void', settled_at = now()
  where bet_id = p_bet_id and status = 'pending';

  insert into public.transactions (league_id, user_id, bet_id, type, amount, balance_after)
  values (v_bet.league_id, v_uid, p_bet_id, 'cashout', v_bet.stake, v_new_balance);

  return v_new_balance;
end;
$$;

grant execute on function public.cashout_prematch(uuid) to authenticated;
