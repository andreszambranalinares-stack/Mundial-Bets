// Edge function: trae partidos y cuotas del Mundial desde The Odds API
// y los sincroniza en la base de datos. Pensada para ejecutarse por cron
// (cada ~30-60 min) o manualmente. Usa service role -> ignora RLS.
import { adminClient, fetchOdds, extractOdds } from '../_shared/odds.ts'

Deno.serve(async () => {
  try {
    const db = adminClient()
    const events = await fetchOdds()

    let matches = 0
    let oddsRows = 0

    for (const ev of events) {
      // Upsert del partido
      const { error: mErr } = await db.from('matches').upsert(
        {
          id: ev.id,
          sport_key: ev.sport_key,
          home_team: ev.home_team,
          away_team: ev.away_team,
          commence_time: ev.commence_time,
          last_odds_update: new Date().toISOString(),
        },
        { onConflict: 'id' },
      )
      if (mErr) throw mErr
      matches++

      // Reemplaza las cuotas del partido (borrar + insertar vigentes)
      const rows = extractOdds(ev).map((r) => ({ match_id: ev.id, ...r, updated_at: new Date().toISOString() }))
      if (rows.length > 0) {
        await db.from('match_odds').delete().eq('match_id', ev.id)
        const { error: oErr } = await db.from('match_odds').insert(rows)
        if (oErr) throw oErr
        oddsRows += rows.length
      }
    }

    return Response.json({ ok: true, matches, oddsRows })
  } catch (e) {
    console.error(e)
    return Response.json({ ok: false, error: String(e) }, { status: 500 })
  }
})
