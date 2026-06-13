-- ============================================================================
-- Programación de tareas (cron) — EJECUTAR EN EL SQL EDITOR DE SUPABASE
-- Rellena xinpxremgudwmieonipr y eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpbnB4cmVtZ3Vkd21pZW9uaXByIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDc1MTY0MSwiZXhwIjoyMDk2MzI3NjQxfQ.lbWivRR56_WViaCPBZYzGoI8w-WJ3DRa0Z5dW61x074 con los de tu proyecto.
-- (Dashboard -> Project Settings -> API). NO subas la service key al repo.
-- ============================================================================

-- Extensiones necesarias (Supabase ya las trae; habilítalas si hace falta)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Refrescar partidos y cuotas cada 30 minutos
select cron.schedule(
  'sync-matches',
  '*/30 * * * *',
  $$
  select net.http_post(
    url     := 'https://xinpxremgudwmieonipr.supabase.co/functions/v1/sync-matches',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpbnB4cmVtZ3Vkd21pZW9uaXByIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDc1MTY0MSwiZXhwIjoyMDk2MzI3NjQxfQ.lbWivRR56_WViaCPBZYzGoI8w-WJ3DRa0Z5dW61x074'
    )
  );
  $$
);

-- Liquidar resultados cada 30 minutos (desfasado 15 min del anterior)
select cron.schedule(
  'settle-results',
  '15,45 * * * *',
  $$
  select net.http_post(
    url     := 'https://xinpxremgudwmieonipr.supabase.co/functions/v1/settle-results',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpbnB4cmVtZ3Vkd21pZW9uaXByIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDc1MTY0MSwiZXhwIjoyMDk2MzI3NjQxfQ.lbWivRR56_WViaCPBZYzGoI8w-WJ3DRa0Z5dW61x074'
    )
  );
  $$
);

-- Marcador en directo cada 2 minutos (Football-Data.org).
-- Solo hace falta durante días de partido; puedes pausarlo el resto del tiempo.
select cron.schedule(
  'sync-live-scores',
  '*/2 * * * *',
  $$
  select net.http_post(
    url     := 'https://xinpxremgudwmieonipr.supabase.co/functions/v1/sync-live-scores',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpbnB4cmVtZ3Vkd21pZW9uaXByIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDc1MTY0MSwiZXhwIjoyMDk2MzI3NjQxfQ.lbWivRR56_WViaCPBZYzGoI8w-WJ3DRa0Z5dW61x074'
    )
  );
  $$
);

-- Resumen de jornada en el muro, una vez al día (23:10 UTC, tras los partidos).
-- Alternativa sin edge function: select cron.schedule('jornada-recap','10 23 * * *',
--   $$ select public.run_jornada_recaps(current_date); $$);
select cron.schedule(
  'jornada-recap',
  '10 23 * * *',
  $$
  select net.http_post(
    url     := 'https://xinpxremgudwmieonipr.supabase.co/functions/v1/jornada-recap',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpbnB4cmVtZ3Vkd21pZW9uaXByIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDc1MTY0MSwiZXhwIjoyMDk2MzI3NjQxfQ.lbWivRR56_WViaCPBZYzGoI8w-WJ3DRa0Z5dW61x074'
    )
  );
  $$
);

-- Para ver/borrar:
--   select * from cron.job;
--   select cron.unschedule('sync-matches');
--   select cron.unschedule('sync-live-scores');
--   select cron.unschedule('jornada-recap');
