-- Habilita Realtime (postgres changes) para sincronizar ranking y apuestas en vivo.
alter publication supabase_realtime add table public.league_members;
alter publication supabase_realtime add table public.bets;
