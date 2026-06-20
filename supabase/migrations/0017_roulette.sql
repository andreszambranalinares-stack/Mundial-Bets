-- ============================================================================
-- 0017_roulette
-- Ruleta europea (un solo cero) con mesa de apuestas estilo casino.
-- A diferencia de la "ruleta de rescate" (0016), aquí el jugador APUESTA sus
-- fichas y puede ganar o perder. El número ganador y el pago los decide el
-- SERVIDOR (no el cliente) para que no se pueda hacer trampa.
-- ============================================================================

-- 1. Permitir el tipo 'roulette' en el ledger de transacciones.
alter table public.transactions drop constraint if exists transactions_type_check;
alter table public.transactions
  add constraint transactions_type_check
  check (type in ('initial','stake','payout','refund','cashout','wheel','roulette'));

-- 2. RPC: jugar una tirada de ruleta.
--    p_bets es un array JSON de apuestas: [{ "type": "...", "value": n, "amount": x }]
--    Tipos admitidos y sus pagos (europea):
--      straight (value 0-36)  -> 35:1  (devuelve 36x)
--      red | black            -> 1:1   (devuelve 2x)
--      even | odd             -> 1:1
--      low (1-18) | high (19-36) -> 1:1
--      dozen (value 1-3)      -> 2:1   (devuelve 3x)
--      column (value 1-3)     -> 2:1
--    Devuelve { number, payout, stake, balance }.
create or replace function public.play_roulette(p_league_id uuid, p_bets jsonb)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_balance numeric;
  v_stake   numeric := 0;
  v_payout  numeric := 0;
  v_n       int;
  v_bet     jsonb;
  v_type    text;
  v_value   int;
  v_amount  numeric;
  v_red constant int[] := array[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  if p_bets is null or jsonb_typeof(p_bets) <> 'array' or jsonb_array_length(p_bets) = 0 then
    raise exception 'No hay apuestas';
  end if;

  select balance into v_balance from public.league_members
   where league_id = p_league_id and user_id = v_uid
   for update;
  if v_balance is null then raise exception 'No perteneces a esta liga'; end if;

  -- Validar importes y sumar el total apostado.
  for v_bet in select * from jsonb_array_elements(p_bets) loop
    v_amount := (v_bet->>'amount')::numeric;
    if v_amount is null or v_amount <= 0 then
      raise exception 'Importe de apuesta inválido';
    end if;
    v_stake := v_stake + v_amount;
  end loop;

  if v_stake > v_balance then
    raise exception 'No tienes suficientes fichas';
  end if;

  -- Número ganador (0..36), elegido por el servidor.
  v_n := floor(random() * 37)::int;

  -- Calcular el pago total de las apuestas ganadoras.
  for v_bet in select * from jsonb_array_elements(p_bets) loop
    v_type   := v_bet->>'type';
    v_amount := (v_bet->>'amount')::numeric;
    v_value  := nullif(v_bet->>'value', '')::int;

    if v_type = 'straight' then
      if v_value = v_n then v_payout := v_payout + v_amount * 36; end if;
    elsif v_type = 'red' then
      if v_n = any(v_red) then v_payout := v_payout + v_amount * 2; end if;
    elsif v_type = 'black' then
      if v_n <> 0 and not (v_n = any(v_red)) then v_payout := v_payout + v_amount * 2; end if;
    elsif v_type = 'even' then
      if v_n <> 0 and v_n % 2 = 0 then v_payout := v_payout + v_amount * 2; end if;
    elsif v_type = 'odd' then
      if v_n % 2 = 1 then v_payout := v_payout + v_amount * 2; end if;
    elsif v_type = 'low' then
      if v_n between 1 and 18 then v_payout := v_payout + v_amount * 2; end if;
    elsif v_type = 'high' then
      if v_n between 19 and 36 then v_payout := v_payout + v_amount * 2; end if;
    elsif v_type = 'dozen' then
      if v_value between 1 and 3 and v_n between (v_value - 1) * 12 + 1 and v_value * 12
        then v_payout := v_payout + v_amount * 3; end if;
    elsif v_type = 'column' then
      if v_value between 1 and 3 and v_n <> 0
         and (case when v_value = 3 then v_n % 3 = 0 else v_n % 3 = v_value end)
        then v_payout := v_payout + v_amount * 3; end if;
    else
      raise exception 'Tipo de apuesta desconocido: %', v_type;
    end if;
  end loop;

  v_balance := v_balance - v_stake + v_payout;

  update public.league_members
    set balance = v_balance
  where league_id = p_league_id and user_id = v_uid;

  insert into public.transactions (league_id, user_id, type, amount, balance_after)
  values (p_league_id, v_uid, 'roulette', v_payout - v_stake, v_balance);

  return jsonb_build_object('number', v_n, 'payout', v_payout, 'stake', v_stake, 'balance', v_balance);
end;
$$;

revoke all on function public.play_roulette(uuid, jsonb) from public;
grant execute on function public.play_roulette(uuid, jsonb) to authenticated;
