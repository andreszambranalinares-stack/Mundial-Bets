import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useLeague } from '../leagues/LeagueLayout'
import { useBetSlip } from '../betslip/BetSlipProvider'
import { fmtDate, fmtOdds } from '../../lib/format'
import { localizeMatch, withFlag } from '../../lib/teams'
import { playersForMatch } from '../../lib/squads'
import { captureError } from '../../lib/monitoring'
import type { AdvancedOdd, Match, MatchOdds } from '../../lib/database.types'
import Countdown from '../../components/Countdown'
import Spinner from '../../components/Spinner'

// Mercados del catálogo avanzado que tratamos como apuestas DE JUGADOR aunque
// en la BD figuren como needs_player=false (estadísticas individuales). Al
// apostar se pide el futbolista y así aparece luego al liquidar.
const PLAYER_MARKETS = new Set<string>(['shots_over'])

export default function MatchDetailPage() {
  const { matchId } = useParams()
  const { league, userId } = useLeague()
  const navigate = useNavigate()
  const [match, setMatch] = useState<Match | null>(null)
  const [odds, setOdds] = useState<MatchOdds[]>([])
  const [adv, setAdv] = useState<AdvancedOdd[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: m } = await supabase.from('matches').select('*').eq('id', matchId!).maybeSingle()
      if (!m) {
        navigate(`/l/${league.id}/partidos`, { replace: true })
        return
      }
      setMatch(localizeMatch(m))
      const [{ data: o }, { data: a }] = await Promise.all([
        supabase.from('match_odds').select('*').eq('match_id', matchId!),
        supabase.from('advanced_odds').select('*').order('sort', { ascending: true }),
      ])
      setOdds((o ?? []) as MatchOdds[])
      // Mercados que tratamos como "de jugador" aunque el catálogo no lo marque
      // (p. ej. tiros a puerta es una estadística individual): así al apostar se
      // pide el futbolista y aparece al liquidar.
      setAdv((a ?? []).map((x) => {
        const ao = x as AdvancedOdd
        return PLAYER_MARKETS.has(ao.market) ? { ...ao, needs_player: true } : ao
      }))
      setLoading(false)
    }
    load()
  }, [matchId, league.id, navigate])

  // Realtime: el marcador en directo se actualiza solo
  useEffect(() => {
    if (!matchId) return
    const channel = supabase
      .channel(`match-${matchId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` },
        (payload) => setMatch(localizeMatch(payload.new as Match)),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [matchId])

  const isOwner = league.owner_id === userId
  const started = match ? new Date(match.commence_time).getTime() <= Date.now() : false

  if (loading || !match) return <Spinner />

  return (
    <div className="space-y-5">
      <button
        onClick={() => navigate(`/l/${league.id}/partidos`)}
        className="text-sm text-slate-500 dark:text-slate-400"
      >
        ‹ Partidos
      </button>

      {/* Cabecera / marcador del partido */}
      <Scoreboard match={match} />

      {started && match.status !== 'live' && match.status !== 'finished' && (
        <div className="card text-center text-sm text-amber-600 dark:text-amber-400">
          El partido ya ha empezado: no se pueden hacer nuevas apuestas.
        </div>
      )}

      {/* Mercado principal (1X2 / over-under) */}
      {!started && <StandardMarkets match={match} odds={odds} />}

      {/* Mercados avanzados por categorías */}
      {!started && adv.length > 0 && <AdvancedMarkets match={match} adv={adv} />}

      {/* Liquidación manual (solo creador de la liga) */}
      {isOwner && <OwnerSettlement match={match} leagueId={league.id} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Marcador (programado / en directo / finalizado)
// ---------------------------------------------------------------------------
const PERIOD_LABEL: Record<string, string> = {
  regular: '',
  half_time: 'Descanso',
  extra_time: 'Prórroga',
  penalties: 'Penaltis',
}

function Scoreboard({ match }: { match: Match }) {
  const live = match.status === 'live'
  const finished = match.status === 'finished'

  if (live || finished) {
    const period = match.period ? PERIOD_LABEL[match.period] : ''
    return (
      <div className="card text-center">
        {live ? (
          <div className="mb-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-red-500">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            EN DIRECTO
            {match.minute != null && match.period !== 'half_time' && <span>· {match.minute}&apos;</span>}
            {period && <span>· {period}</span>}
          </div>
        ) : (
          <div className="mb-2 text-xs font-semibold text-slate-500">FINAL</div>
        )}
        <div className="flex items-center justify-center gap-4">
          <span className="flex-1 text-right font-semibold text-slate-900 dark:text-white">{withFlag(match.home_team)}</span>
          <span className="text-3xl font-bold text-slate-900 tabular-nums dark:text-white">
            {match.home_score ?? 0} <span className="text-slate-400">-</span> {match.away_score ?? 0}
          </span>
          <span className="flex-1 text-left font-semibold text-slate-900 dark:text-white">{withFlag(match.away_team)}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="card text-center">
      <div className="mb-2 flex items-center justify-center gap-2 text-xs text-slate-500">
        <span>{fmtDate(match.commence_time)}</span>
        <Countdown target={match.commence_time} />
      </div>
      <div className="text-lg font-bold text-slate-900 dark:text-white">
        {withFlag(match.home_team)} <span className="text-slate-400">vs</span> {withFlag(match.away_team)}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Mercado estándar (reaprovecha la hoja de apuesta)
// ---------------------------------------------------------------------------
function StandardMarkets({ match, odds }: { match: Match; odds: MatchOdds[] }) {
  const { toggle, isSelected } = useBetSlip()
  const h2h = (sel: string) => odds.find((o) => o.market === 'h2h' && o.selection === sel)
  const over = odds.find((o) => o.market === 'totals' && o.selection === 'over')
  const under = odds.find((o) => o.market === 'totals' && o.selection === 'under')

  const pick = (o: MatchOdds) =>
    toggle({ match, market: o.market, selection: o.selection, point: o.point, price: o.price })
  const sel = (o?: MatchOdds) => (o ? isSelected(o.match_id, o.market, o.selection, o.point) : false)

  return (
    <section className="space-y-2">
      <h3 className="px-1 text-sm font-semibold text-slate-500 dark:text-slate-300">Ganador del partido</h3>
      <div className="grid grid-cols-3 gap-2">
        <OddBtn label={withFlag(match.home_team)} price={h2h('home')?.price} onPick={() => h2h('home') && pick(h2h('home')!)} active={sel(h2h('home'))} />
        <OddBtn label="Empate" price={h2h('draw')?.price} onPick={() => h2h('draw') && pick(h2h('draw')!)} active={sel(h2h('draw'))} />
        <OddBtn label={withFlag(match.away_team)} price={h2h('away')?.price} onPick={() => h2h('away') && pick(h2h('away')!)} active={sel(h2h('away'))} />
      </div>
      {(over || under) && (
        <div className="grid grid-cols-2 gap-2">
          <OddBtn label={`Más de ${over?.point ?? under?.point} goles`} price={over?.price} onPick={() => over && pick(over)} active={sel(over)} />
          <OddBtn label={`Menos de ${under?.point ?? over?.point} goles`} price={under?.price} onPick={() => under && pick(under)} active={sel(under)} />
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Mercados avanzados por categorías (estilo Bet365)
// ---------------------------------------------------------------------------
function AdvancedMarkets({ match, adv }: { match: Match; adv: AdvancedOdd[] }) {
  const categories = useMemo(() => [...new Set(adv.map((a) => a.category))], [adv])
  const [active, setActive] = useState(categories[0])
  const [player, setPlayer] = useState('')
  // Jugadores sugeridos de los dos equipos del partido (autocompletado).
  const suggestions = useMemo(() => playersForMatch(match.home_team, match.away_team), [match])

  const options = adv.filter((a) => a.category === active)
  const needsPlayer = options.some((o) => o.needs_player)
  const listId = `players-${match.id}`

  return (
    <section className="space-y-3">
      <h3 className="px-1 text-sm font-semibold text-slate-500 dark:text-slate-300">Más apuestas</h3>

      {/* Barra de categorías con scroll horizontal */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => {
              setActive(c)
              setPlayer('')
            }}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              c === active
                ? 'bg-brand text-slate-900'
                : 'bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {needsPlayer && (
        <>
          <input
            className="input"
            placeholder="Nombre del jugador"
            value={player}
            onChange={(e) => setPlayer(e.target.value)}
            list={suggestions.length > 0 ? listId : undefined}
            autoComplete="off"
          />
          {suggestions.length > 0 && (
            <datalist id={listId}>
              {suggestions.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          )}
        </>
      )}

      <div className="grid grid-cols-2 gap-2">
        {options.map((o) => (
          <AdvancedOption key={o.id} match={match} odd={o} player={player} />
        ))}
      </div>
    </section>
  )
}

function AdvancedOption({ match, odd, player }: { match: Match; odd: AdvancedOdd; player: string }) {
  const { toggle, isSelected } = useBetSlip()
  const needName = odd.needs_player
  const disabled = needName && !player.trim()
  const active = isSelected(match.id, odd.market, odd.selection, 0, needName ? player.trim() : undefined)

  const label = odd.label.replace('Local', match.home_team).replace('Visitante', match.away_team)
  const display = needName ? `${player.trim() || 'Jugador'} ${label}` : label

  function pick() {
    if (disabled) return
    toggle({
      match,
      market: odd.market,
      selection: odd.selection,
      point: 0,
      price: odd.price,
      label: odd.label,
      playerName: needName ? player.trim() : undefined,
    })
  }

  return (
    <button
      onClick={pick}
      disabled={disabled}
      className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition active:scale-95 disabled:opacity-40 ${
        active
          ? 'border-brand bg-brand/20'
          : 'border-slate-300 bg-slate-100 hover:border-brand dark:border-slate-700 dark:bg-slate-800'
      }`}
    >
      <span className="min-w-0 truncate text-xs text-slate-600 dark:text-slate-300">{display}</span>
      <span className="shrink-0 font-bold text-brand">{fmtOdds(odd.price)}</span>
    </button>
  )
}

function OddBtn({
  label,
  price,
  onPick,
  active,
}: {
  label: string
  price?: number
  onPick: () => void
  active: boolean
}) {
  if (price == null) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-slate-100 px-1 py-2 text-slate-400 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-600">
        <span className="text-center text-xs leading-tight">{label}</span>
        <span className="text-sm">—</span>
      </div>
    )
  }
  return (
    <button
      onClick={onPick}
      className={`flex flex-col items-center justify-between gap-1 rounded-xl border px-1 py-2 transition active:scale-95 ${
        active
          ? 'border-brand bg-brand/20'
          : 'border-slate-300 bg-slate-100 hover:border-brand dark:border-slate-700 dark:bg-slate-800'
      }`}
    >
      <span className="line-clamp-2 text-center text-xs leading-tight text-slate-500 dark:text-slate-400">{label}</span>
      <span className="font-bold text-brand">{fmtOdds(price)}</span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Liquidación manual de apuestas avanzadas (solo el creador de la liga)
// ---------------------------------------------------------------------------
type PendingGroup = {
  market: string
  selection: string
  label: string | null
  player_name: string | null
  count: number
}

function OwnerSettlement({ match, leagueId }: { match: Match; leagueId: string }) {
  const [groups, setGroups] = useState<PendingGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  async function load() {
    const { data } = await supabase
      .from('bet_legs')
      .select('market, selection, label, player_name, status, bets!inner(league_id)')
      .eq('bets.league_id', leagueId)
      .eq('match_id', match.id)
      .eq('status', 'pending')
    // Solo mercados avanzados, agrupados por (market, selection, jugador)
    const map = new Map<string, PendingGroup>()
    for (const row of (data ?? []) as unknown as PendingGroup[]) {
      if (row.market === 'h2h' || row.market === 'totals') continue
      const key = `${row.market}|${row.selection}|${row.player_name ?? ''}`
      const g = map.get(key)
      if (g) g.count++
      else map.set(key, { ...row, count: 1 })
    }
    setGroups([...map.values()])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.id, leagueId])

  async function settle(g: PendingGroup, result: 'won' | 'lost' | 'void') {
    const key = `${g.market}|${g.selection}|${g.player_name ?? ''}`
    setBusy(key)
    const { error } = await supabase.rpc('settle_advanced', {
      p_league_id: leagueId,
      p_match_id: match.id,
      p_market: g.market,
      p_selection: g.selection,
      p_player_name: g.player_name,
      p_result: result,
    })
    if (error) captureError(error, 'settle_advanced')
    setBusy(null)
    load()
  }

  if (loading) return null
  if (groups.length === 0) return null

  return (
    <section className="card space-y-3 border-amber-400/40">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
        Liquidar apuestas avanzadas <span className="text-xs font-normal text-slate-500">(solo tú, como creador)</span>
      </h3>
      {groups.map((g) => {
        const key = `${g.market}|${g.selection}|${g.player_name ?? ''}`
        const text = (g.player_name ? `${g.player_name} ` : '') +
          (g.label ?? `${g.market}/${g.selection}`)
            .replace('Local', match.home_team)
            .replace('Visitante', match.away_team)
        return (
          <div key={key} className="rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
            <div className="mb-2 text-sm text-slate-700 dark:text-slate-200">
              {text} <span className="text-xs text-slate-500">· {g.count} apuesta(s)</span>
            </div>
            <div className="flex gap-2">
              <button
                className="btn flex-1 bg-brand py-1.5 text-xs text-slate-900 hover:bg-brand-dark"
                disabled={busy === key}
                onClick={() => settle(g, 'won')}
              >
                Acertó
              </button>
              <button
                className="btn flex-1 bg-red-600 py-1.5 text-xs text-white hover:bg-red-700"
                disabled={busy === key}
                onClick={() => settle(g, 'lost')}
              >
                Falló
              </button>
              <button
                className="btn-ghost flex-1 py-1.5 text-xs"
                disabled={busy === key}
                onClick={() => settle(g, 'void')}
              >
                Anular
              </button>
            </div>
          </div>
        )
      })}
    </section>
  )
}
