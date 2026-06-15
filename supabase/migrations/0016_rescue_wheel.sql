-- ============================================================================
-- 0016_rescue_wheel
-- "Ruleta de rescate": cuando un miembro se queda con 0 fichas en una liga,
-- puede girar una ruleta que le regala fichas. El premio lo decide el SERVIDOR
-- (no el cliente) con probabilidades ponderadas, para que no se pueda hacer
-- trampa. Solo se puede girar si el saldo es exactamente 0.
-- ============================================================================

-- 1. Permitir el tipo 'wheel' en el ledger de transacciones.
--    Se mantienen todos los tipos existentes (incl. 'cashout' de la 0003).
alter table public.transactions drop constraint if exists transactions_type_check;
alter table public.transactions
  add constraint transactions_type_check
  check (type in ('initial','stake','payout','refund','cashout','wheel'));

-- 2. RPC: girar la ruleta de rescate.
--    Premios y probabilidades (deben coincidir con el frontend):
--      10  -> 35%
--      50  -> 27%
--      100 -> 20%
--      500 -> 11%
--      1000->  5%
--      5000->  2%   (la porción minúscula)
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
  if v_balance > 0 then
    raise exception 'Solo puedes girar la ruleta cuando te quedas sin fichas';
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
