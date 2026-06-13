-- ============================================================================
-- Fase 5 — Func 15: Marcador en directo
-- Campos de estado en vivo en matches y Realtime para que el marcador se
-- actualice solo en la vista de detalle. Los datos los rellena la edge
-- function sync-live-scores (Football-Data.org).
-- ============================================================================

alter table public.matches add column if not exists minute int;
alter table public.matches add column if not exists period text
  check (period is null or period in ('regular','half_time','extra_time','penalties'));

-- Realtime para el marcador en vivo (la vista de detalle se suscribe a su fila)
alter publication supabase_realtime add table public.matches;
