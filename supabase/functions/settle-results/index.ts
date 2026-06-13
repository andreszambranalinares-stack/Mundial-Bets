// Edge function: consulta resultados de partidos finalizados en The Odds API,
// actualiza el marcador y liquida las apuestas pendientes llamando a settle_match().
// Pensada para cron (cada ~30 min). Usa service role -> ignora RLS.
import { adminClient, fetchScores } from '../_shared/odds.ts'

Deno.serve(async () => {
  try {
    const db = adminClient()
    const events = await fetchScores(3)

    let settled = 0

    for (const ev of events) {
      if (!ev.completed || !ev.scores) continue

      const home = ev.scores.find((s) => s.name === ev.home_team)
      const away = ev.scores.find((s) => s.name === ev.away_team)
      if (!home || !away) continue

      const homeScore = parseInt(home.score, 10)
      const awayScore = parseInt(away.score, 10)
      if (Number.isNaN(homeScore) || Number.isNaN(awayScore)) continue

      // Solo liquidamos si el partido existe en nuestra DB y sigue sin liquidar
      const { data: match } = await db
        .from('matches')
        .select('id, status')
        .eq('id', ev.id)
        .maybeSingle()
      if (!match || match.status === 'finished') continue

      await db
        .from('matches')
        .update({ home_score: homeScore, away_score: awayScore })
        .eq('id', ev.id)

      const { error } = await db.rpc('settle_match', { p_match_id: ev.id })
      if (error) throw error
      settled++
    }

    return Response.json({ ok: true, settled })
  } catch (e) {
    console.error(e)
    return Response.json({ ok: false, error: String(e) }, { status: 500 })
  }
})
