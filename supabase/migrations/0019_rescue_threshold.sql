-- ============================================================================
-- 0019_rescue_threshold
-- Antes la ruleta de rescate solo se podía girar con saldo EXACTAMENTE 0.
-- Problema: con un saldo positivo pero por debajo del mínimo para apostar
-- (la ficha más pequeña de la ruleta es 10) el jugador se quedaba bloqueado:
-- no podía apostar ni girar el rescate. Ahora se permite girar cuando el saldo
-- está por debajo de ese mínimo (< 10). El umbral debe coincidir con el
-- frontend (RESCUE_THRESHOLD en LeagueLayout).
-- ============================================================================

create or replace function public.spin_rescue_wheel(p_league_id uuid)
returns numeric
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_balance numeric;
  v_r       numeric := random();
  v_prize   numeric;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;

  select balance into v_balance from public.league_members
  where league_id = p_league_id and user_id = v_uid
  for update;
  if v_balance is null then raise exception 'No perteneces a esta liga'; end if;
  if v_balance >= 10 then
    raise exception 'Solo puedes girar la ruleta cuando casi no te quedan fichas';
  end if;

  if    v_r < 0.35 then v_prize := 10;
  elsif v_r < 0.62 then v_prize := 50;
  elsif v_r < 0.82 then v_prize := 100;
  elsif v_r < 0.93 then v_prize := 500;
  elsif v_r < 0.98 then v_prize := 1000;
  else                  v_prize := 5000;
  end if;

  update public.league_members
    set balance = balance + v_prize
  where league_id = p_league_id and user_id = v_uid;

  insert into public.transactions (league_id, user_id, type, amount, balance_after)
  values (p_league_id, v_uid, 'wheel', v_prize, v_balance + v_prize);

  return v_prize;
end;
$$;

revoke all on function public.spin_rescue_wheel(uuid) from public;
grant execute on function public.spin_rescue_wheel(uuid) to authenticated;
