-- ============================================================================
-- Tests pgTAP de la lógica de dinero (place_combo_bet / settle_match / settle_ticket).
-- Ejecutar con la CLI de Supabase (levanta una DB local con las migraciones):
--     supabase test db
-- Cubre los invariantes que no pueden romperse: el stake se descuenta exacto,
-- se rechazan apuestas inválidas, y la liquidación paga/devuelve lo correcto.
-- ============================================================================
begin;
create extension if not exists pgtap;
select plan(9);

-- --- Fixtures -----------------------------------------------------------------
-- Dos usuarios (el trigger on_auth_user_created crea sus profiles)
insert into auth.users (id, email, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.com', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.com', 'authenticated', 'authenticated'),
  ('44444444-4444-4444-4444-444444444444', 'c@test.com', 'authenticated', 'authenticated');

-- Liga + miembros con 1000 fichas
insert into public.leagues (id, name, invite_code, owner_id, starting_chips)
values ('33333333-3333-3333-3333-333333333333', 'Test', 'TESTAA',
        '11111111-1111-1111-1111-111111111111', 1000);
insert into public.league_members (league_id, user_id, balance) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 1000),
  ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 1000),
  ('33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444', 1000);

-- Partidos (futuros) + cuotas
insert into public.matches (id, home_team, away_team, commence_time, status) values
  ('m1', 'A', 'B', now() + interval '1 day', 'scheduled'),
  ('m2', 'C', 'D', now() + interval '1 day', 'scheduled'),
  ('m3', 'E', 'F', now() + interval '1 day', 'scheduled');
insert into public.match_odds (match_id, market, selection, point, price) values
  ('m1', 'h2h', 'home', 0, 2.0),
  ('m1', 'totals', 'over', 2.5, 1.8),
  ('m2', 'totals', 'over', 2, 1.8),
  ('m2', 'totals', 'under', 2, 1.9),
  ('m3', 'h2h', 'home', 0, 2.0),
  ('m3', 'totals', 'over', 2.5, 1.8);

-- Iniciar sesión como usuario A (auth.uid() lee request.jwt.claims.sub)
select set_config('request.jwt.claims',
  json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);

-- --- place_combo_bet ----------------------------------------------------------
select lives_ok($$
  select public.place_combo_bet('33333333-3333-3333-3333-333333333333', 100,
    '[{"match_id":"m1","market":"h2h","selection":"home","point":0}]'::jsonb)
$$, 'A apuesta 100 a la victoria local de m1');

select is(
  (select balance from public.league_members
   where league_id = '33333333-3333-3333-3333-333333333333'
     and user_id = '11111111-1111-1111-1111-111111111111'),
  900::numeric, 'El stake se descuenta exacto (1000 -> 900)');

select is(
  (select amount from public.transactions
   where league_id = '33333333-3333-3333-3333-333333333333'
     and user_id = '11111111-1111-1111-1111-111111111111' and type = 'stake'
   order by id desc limit 1),
  -100::numeric, 'Se registra el asiento de stake -100 en el ledger');

select throws_ok($$
  select public.place_combo_bet('33333333-3333-3333-3333-333333333333', 99999,
    '[{"match_id":"m1","market":"h2h","selection":"home","point":0}]'::jsonb)
$$, null, 'Rechaza apostar más fichas de las que se tienen');

-- Combinada con dos selecciones del MISMO partido (usuario C, partido aislado m3)
select set_config('request.jwt.claims',
  json_build_object('sub', '44444444-4444-4444-4444-444444444444', 'role', 'authenticated')::text, true);
select lives_ok($$
  select public.place_combo_bet('33333333-3333-3333-3333-333333333333', 50,
    '[{"match_id":"m3","market":"h2h","selection":"home","point":0},
      {"match_id":"m3","market":"totals","selection":"over","point":2.5}]'::jsonb)
$$, 'Permite combinar dos selecciones del mismo partido');
-- Volver a la sesión del usuario A para el resto de las comprobaciones
select set_config('request.jwt.claims',
  json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);

-- --- settle_match: A gana -----------------------------------------------------
update public.matches set home_score = 2, away_score = 0 where id = 'm1';
select lives_ok($$ select public.settle_match('m1') $$, 'Se liquida m1 con victoria local');

select is(
  (select balance from public.league_members
   where league_id = '33333333-3333-3333-3333-333333333333'
     and user_id = '11111111-1111-1111-1111-111111111111'),
  1100::numeric, 'Paga stake*cuota al ganar (900 + 100*2.0 = 1100)');

-- --- settle_match: push (total = línea) => devolución ---------------------------
select set_config('request.jwt.claims',
  json_build_object('sub', '22222222-2222-2222-2222-222222222222', 'role', 'authenticated')::text, true);
select public.place_combo_bet('33333333-3333-3333-3333-333333333333', 100,
  '[{"match_id":"m2","market":"totals","selection":"over","point":2}]'::jsonb);

update public.matches set home_score = 1, away_score = 1 where id = 'm2';  -- total = 2 = línea => push
select public.settle_match('m2');

select is(
  (select balance from public.league_members
   where league_id = '33333333-3333-3333-3333-333333333333'
     and user_id = '22222222-2222-2222-2222-222222222222'),
  1000::numeric, 'Push (total = línea) devuelve el stake íntegro (1000)');

select finish();
rollback;
