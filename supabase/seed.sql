-- Datos de prueba para desarrollo local (no usar en producción).
-- Dos partidos de ejemplo con cuotas, para poder apostar sin la API real.

insert into public.matches (id, sport_key, home_team, away_team, commence_time, status)
values
  ('demo-esp-bra', 'soccer_fifa_world_cup', 'España', 'Brasil', now() + interval '2 hours', 'scheduled'),
  ('demo-arg-fra', 'soccer_fifa_world_cup', 'Argentina', 'Francia', now() + interval '1 day', 'scheduled')
on conflict (id) do nothing;

insert into public.match_odds (match_id, market, selection, point, price) values
  ('demo-esp-bra', 'h2h', 'home', 0, 2.40),
  ('demo-esp-bra', 'h2h', 'draw', 0, 3.20),
  ('demo-esp-bra', 'h2h', 'away', 0, 2.90),
  ('demo-esp-bra', 'totals', 'over', 2.5, 1.85),
  ('demo-esp-bra', 'totals', 'under', 2.5, 1.95),
  ('demo-arg-fra', 'h2h', 'home', 0, 2.10),
  ('demo-arg-fra', 'h2h', 'draw', 0, 3.30),
  ('demo-arg-fra', 'h2h', 'away', 0, 3.40),
  ('demo-arg-fra', 'totals', 'over', 2.5, 1.90),
  ('demo-arg-fra', 'totals', 'under', 2.5, 1.90)
on conflict (match_id, market, selection, point) do update set price = excluded.price;
