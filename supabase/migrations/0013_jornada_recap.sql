-- ============================================================================
-- B3 — Resumen automático de jornada en el muro de actividad.
-- Una función agregada calcula, por liga con apuestas en una fecha, el mayor
-- ganador y perdedor del día (neto del ledger) y el mayor "batacazo" (boleto
-- ganado con la cuota más alta), y publica un evento 'jornada_recap'.
-- La dispara un cron (o la edge function jornada-recap) una vez al día.
-- ============================================================================

-- 1. Permitir el nuevo tipo de actividad
alter table public.league_activity drop constraint if exists league_activity_type_check;
alter table public.league_activity add constraint league_activity_type_check
  check (type in (
    'member_joined','bet_placed','bet_won','bet_lost',
    'pool_joined','pool_settled','jornada_recap'
  ));

-- 2. Publica el recap de UNA liga para una fecha (idempotente vía run_jornada_recaps)
create or replace function public._post_one_recap(p_league_id uuid, p_date date)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_owner      uuid;
  v_winner     uuid;
  v_winner_net numeric;
  v_loser      uuid;
  v_loser_net  numeric;
  v_top_odds   numeric;
  v_top_user   uuid;
begin
  select owner_id into v_owner from public.leagues where id = p_league_id;
  if v_owner is null then return; end if;

  -- Neto del día por miembro (suma de movimientos del ledger en esa fecha).
  with net as (
    select user_id, sum(amount) as net
    from public.transactions
    where league_id = p_league_id and date(created_at) = p_date
    group by user_id
  )
  select user_id, net into v_winner, v_winner_net from net order by net desc nulls last limit 1;

  with net as (
    select user_id, sum(amount) as net
    from public.transactions
    where league_id = p_league_id and date(created_at) = p_date
    group by user_id
  )
  select user_id, net into v_loser, v_loser_net from net order by net asc nulls last limit 1;

  -- Mayor batacazo: boleto ganado y liquidado ese día con la cuota más alta.
  select combined_odds, user_id into v_top_odds, v_top_user
  from public.bets
  where league_id = p_league_id and status = 'won' and date(settled_at) = p_date
  order by combined_odds desc nulls last limit 1;

  insert into public.league_activity (league_id, user_id, type, payload)
  values (p_league_id, v_owner, 'jornada_recap', jsonb_build_object(
    'date', p_date::text,
    'winner_id', v_winner, 'winner_net', v_winner_net,
    'loser_id', v_loser, 'loser_net', v_loser_net,
    'top_odds', v_top_odds, 'top_user', v_top_user
  ));
end;
$$;

-- 3. Publica el recap de todas las ligas con partidos jugados en p_date.
--    Idempotente: salta las ligas que ya tengan recap de esa fecha.
create or replace function public.run_jornada_recaps(p_date date default current_date)
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  r       record;
  v_count int := 0;
begin
  for r in
    select distinct b.league_id
    from public.bets b
    join public.bet_legs bl on bl.bet_id = b.id
    join public.matches m on m.id = bl.match_id
    where date(m.commence_time) = p_date
  loop
    if exists (
      select 1 from public.league_activity
      where league_id = r.league_id and type = 'jornada_recap'
        and payload->>'date' = p_date::text
    ) then
      continue;
    end if;
    perform public._post_one_recap(r.league_id, p_date);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- 4. Solo el service role (edge function / cron) la ejecuta.
revoke all on function public._post_one_recap(uuid, date) from public;
revoke all on function public.run_jornada_recaps(date) from public;
