-- ============================================================================
-- Fase 5 — Func 13: Historial de la liga por jornadas
-- Las "jornadas" son las fechas (día) de los partidos sobre los que la liga ha
-- apostado. Para cada jornada se devuelve el saldo de cada miembro tal como
-- estaba al comenzar la siguiente jornada (es decir, ya con esa jornada liquidada).
-- Se calcula del ledger `transactions` server-side: así un miembro ve la
-- evolución de TODOS sin exponer las transacciones ajenas (RLS las protege).
-- ============================================================================

create or replace function public.league_history(p_league_id uuid)
returns table (jornada int, jornada_date date, user_id uuid, balance numeric)
language plpgsql
security definer set search_path = public
stable
as $$
begin
  if not public.is_league_member(p_league_id) then
    raise exception 'No perteneces a esta liga';
  end if;

  return query
  with j as (
    select d,
           row_number() over (order by d) as idx,
           lead(d) over (order by d) as next_d
    from (
      select distinct date(m.commence_time) as d
      from public.matches m
      where exists (
        select 1 from public.bets b
        join public.bet_legs bl on bl.bet_id = b.id
        where b.league_id = p_league_id and bl.match_id = m.id
      )
    ) s
  ),
  members as (
    select lm.user_id, l.starting_chips
    from public.league_members lm
    join public.leagues l on l.id = lm.league_id
    where lm.league_id = p_league_id
  )
  select j.idx::int as jornada,
         j.d as jornada_date,
         mem.user_id,
         coalesce(
           (select t.balance_after
            from public.transactions t
            where t.league_id = p_league_id and t.user_id = mem.user_id
              and t.created_at < coalesce(j.next_d::timestamptz, 'infinity'::timestamptz)
            order by t.created_at desc
            limit 1),
           mem.starting_chips
         ) as balance
  from j cross join members mem
  order by j.idx, balance desc;
end;
$$;

grant execute on function public.league_history(uuid) to authenticated;
