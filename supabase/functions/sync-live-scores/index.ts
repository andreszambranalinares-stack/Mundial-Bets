// Edge function: trae el marcador en directo del Mundial desde Football-Data.org
// y lo refleja en nuestra tabla matches (estado 'live', marcador, minuto, periodo).
// Cuando un partido finaliza, fija el resultado y liquida con settle_match().
// Pensada para cron frecuente en días de partido (cada 1-2 min). Usa service role.
import { adminClient } from '../_shared/odds.ts'
import { fetchWorldCupMatches, normalizeTeam, fdPeriod } from '../_shared/footballdata.ts'

Deno.serve(async () => {
  try {
    const db = adminClient()
    const fdMatches = await fetchWorldCupMatches()

    // Candidatos: nuestros partidos aún no finalizados
    const { data: ours } = await db
      .from('matches')
      .select('id, home_team, away_team, status')
      .neq('status', 'finished')

    const byTeams = new Map<string, { id: string; status: string }>()
    for (const m of ours ?? []) {
      byTeams.set(`${normalizeTeam(m.home_team)}|${normalizeTeam(m.away_team)}`, {
        id: m.id,
        status: m.status,
      })
    }

    let live = 0
    let finished = 0

    for (const fd of fdMatches) {
      const key = `${normalizeTeam(fd.homeTeam.name)}|${normalizeTeam(fd.awayTeam.name)}`
      const m = byTeams.get(key)
      if (!m) continue

      const hs = fd.score?.fullTime?.home
      const as = fd.score?.fullTime?.away

      if (fd.status === 'IN_PLAY' || fd.status === 'PAUSED') {
        await db
          .from('matches')
          .update({
            status: 'live',
            home_score: hs ?? 0,
            away_score: as ?? 0,
            minute: fd.minute != null ? parseInt(String(fd.minute), 10) || null : null,
            period: fdPeriod(fd),
            scores_updated_at: new Date().toISOString(),
          })
          .eq('id', m.id)
        live++
      } else if (fd.status === 'FINISHED' && m.status !== 'finished') {
        if (hs == null || as == null) continue
        await db
          .from('matches')
          .update({ home_score: hs, away_score: as, minute: null, period: null })
          .eq('id', m.id)
        // settle_match fija status='finished' y liquida las patas estándar.
        const { error } = await db.rpc('settle_match', { p_match_id: m.id })
        if (error) throw error
        finished++
      }
    }

    return Response.json({ ok: true, fd: fdMatches.length, live, finished })
  } catch (e) {
    console.error(e)
    return Response.json({ ok: false, error: String(e) }, { status: 500 })
  }
})
