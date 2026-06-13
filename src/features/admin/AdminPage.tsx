import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { localizeMatch, withFlag } from '../../lib/teams'
import { fmtDate } from '../../lib/format'
import { captureError } from '../../lib/monitoring'
import type { League, Match } from '../../lib/database.types'
import Spinner from '../../components/Spinner'

// Una pata avanzada pendiente, leída de bet_legs (+ league_id vía bets).
type LegRow = {
  match_id: string
  market: string
  selection: string
  label: string | null
  player_name: string | null
}

// Grupo de patas idénticas (mismo mercado/selección/jugador) a liquidar de golpe.
type Group = {
  market: string
  selection: string
  label: string | null
  player_name: string | null
  count: number
}

type MatchSettlement = { matchId: string; match: Match | null; groups: Group[] }
type LeagueSettlement = { league: League; matches: MatchSettlement[] }

const groupKey = (g: { market: string; selection: string; player_name: string | null }) =>
  `${g.market}|${g.selection}|${g.player_name ?? ''}`

export default function AdminPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<LeagueSettlement[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    // Ligas que administras (eres el creador / owner).
    const { data: ls } = await supabase.from('leagues').select('*').eq('owner_id', user!.id)
    const leagues = (ls ?? []) as League[]

    const result: LeagueSettlement[] = []
    for (const league of leagues) {
      // Patas pendientes de toda la liga (RLS permite verlas al ser miembro).
      const { data: legs } = await supabase
        .from('bet_legs')
        .select('match_id, market, selection, label, player_name, bets!inner(league_id)')
        .eq('bets.league_id', league.id)
        .eq('status', 'pending')

      // Solo mercados avanzados: h2h/totals se liquidan solos por el marcador.
      const advanced = ((legs ?? []) as unknown as LegRow[]).filter(
        (l) => l.market !== 'h2h' && l.market !== 'totals',
      )
      if (advanced.length === 0) {
        result.push({ league, matches: [] })
        continue
      }

      // Partidos implicados (para mostrar nombre/fecha).
      const matchIds = [...new Set(advanced.map((l) => l.match_id))]
      const { data: ms } = await supabase.from('matches').select('*').in('id', matchIds)
      const byId = new Map((ms ?? []).map((m) => [m.id, localizeMatch(m as Match)]))

      // Agrupar por partido -> (mercado, selección, jugador).
      const perMatch = new Map<string, Group[]>()
      for (const l of advanced) {
        const groups = perMatch.get(l.match_id) ?? []
        const existing = groups.find((g) => groupKey(g) === groupKey(l))
        if (existing) existing.count++
        else
          groups.push({
            market: l.market,
            selection: l.selection,
            label: l.label,
            player_name: l.player_name,
            count: 1,
          })
        perMatch.set(l.match_id, groups)
      }

      const matches: MatchSettlement[] = [...perMatch.entries()].map(([matchId, groups]) => ({
        matchId,
        match: byId.get(matchId) ?? null,
        groups,
      }))
      // Partidos ya jugados primero (los que más urge liquidar).
      matches.sort((a, b) => (a.match?.commence_time ?? '').localeCompare(b.match?.commence_time ?? ''))
      result.push({ league, matches })
    }
    setData(result)
    setLoading(false)
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  async function settle(leagueId: string, matchId: string, g: Group, result: 'won' | 'lost' | 'void') {
    const key = `${leagueId}|${matchId}|${groupKey(g)}`
    setBusy(key)
    const { error } = await supabase.rpc('settle_advanced', {
      p_league_id: leagueId,
      p_match_id: matchId,
      p_market: g.market,
      p_selection: g.selection,
      p_player_name: g.player_name,
      p_result: result,
    })
    if (error) {
      captureError(error, 'settle_advanced')
      alert(error.message)
    }
    setBusy(null)
    await load()
  }

  if (loading) return <Spinner label="Cargando administración..." />

  return (
    <div className="mx-auto min-h-full max-w-md px-5 py-6">
      <div className="mb-6 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="text-sm text-slate-500 dark:text-slate-400">
          ‹ Volver
        </button>
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">Administración</h1>
        <span className="w-12" />
      </div>

      {data.length === 0 ? (
        <div className="card text-center text-sm text-slate-500 dark:text-slate-400">
          No administras ninguna liga. Solo el creador de una liga puede liquidar apuestas.
        </div>
      ) : (
        <div className="space-y-6">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Aquí liquidas manualmente las apuestas de mercados especiales (goleador, tarjetas…). Las
            apuestas de ganador y de goles se liquidan solas con el resultado del partido.
          </p>

          {data.map(({ league, matches }) => (
            <section key={league.id} className="space-y-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">{league.name}</h2>

              {matches.length === 0 ? (
                <p className="rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  No hay apuestas pendientes de liquidar.
                </p>
              ) : (
                matches.map(({ matchId, match, groups }) => (
                  <div key={matchId} className="card space-y-3">
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {match ? `${withFlag(match.home_team)} vs ${withFlag(match.away_team)}` : matchId}
                      </div>
                      {match && (
                        <div className="text-xs text-slate-500">{fmtDate(match.commence_time)}</div>
                      )}
                    </div>

                    {groups.map((g) => {
                      const key = `${league.id}|${matchId}|${groupKey(g)}`
                      const text =
                        (g.player_name ? `${g.player_name} · ` : '') +
                        (g.label ?? `${g.market}/${g.selection}`)
                          .replace('Local', match?.home_team ?? 'Local')
                          .replace('Visitante', match?.away_team ?? 'Visitante')
                      return (
                        <div key={key} className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
                          <div className="mb-2 text-sm text-slate-700 dark:text-slate-200">
                            {text}{' '}
                            <span className="text-xs text-slate-500">· {g.count} apuesta(s)</span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              className="btn flex-1 bg-brand py-1.5 text-xs text-slate-900 hover:bg-brand-dark"
                              disabled={busy === key}
                              onClick={() => settle(league.id, matchId, g, 'won')}
                            >
                              Acertó
                            </button>
                            <button
                              className="btn flex-1 bg-red-600 py-1.5 text-xs text-white hover:bg-red-700"
                              disabled={busy === key}
                              onClick={() => settle(league.id, matchId, g, 'lost')}
                            >
                              Falló
                            </button>
                            <button
                              className="btn-ghost flex-1 py-1.5 text-xs"
                              disabled={busy === key}
                              onClick={() => settle(league.id, matchId, g, 'void')}
                            >
                              Anular
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
