// Edge function: publica el resumen de la jornada en el muro de cada liga.
// Llama a la RPC run_jornada_recaps (toda la lógica vive en SQL). Pensada para
// cron 1×/día tras los partidos. Usa service role -> ignora RLS.
// Acepta ?date=YYYY-MM-DD para reprocesar un día concreto (por defecto, hoy).
import { adminClient } from '../_shared/odds.ts'

Deno.serve(async (req) => {
  try {
    const db = adminClient()
    const url = new URL(req.url)
    const date = url.searchParams.get('date') // null => current_date en SQL

    const { data, error } = await db.rpc('run_jornada_recaps', date ? { p_date: date } : {})
    if (error) throw error

    return Response.json({ ok: true, recaps: data })
  } catch (e) {
    console.error(e)
    return Response.json({ ok: false, error: String(e) }, { status: 500 })
  }
})
