import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { fmtDate, fmtOdds } from '../../lib/format'
import type { Match, MatchOdds, Selection } from '../../lib/database.types'
import { localizeMatch } from '../../lib/teams'
import Spinner from '../../components/Spinner'
import Countdown from '../../components/Countdown'
import { useBetSlip } from '../betslip/BetSlipProvider'
import { useLeague } from '../leagues/LeagueLayout'

const VISIBLE_DAYS = 3 // días que se muestran abiertos de primeras

type DayGroup = { key: string; label: string; matches: Match[] }

function dayKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}
function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
}

function groupByDay(matches: Match[]): DayGroup[] {
  const groups: DayGroup[] = []
  for (const m of matches) {
    const key = dayKey(m.commence_time)
    let g = groups.find((x) => x.key === key)
    if (!g) {
      g = { key, label: dayLabel(m.commence_time), matches: [] }
      groups.push(g)
    }
    g.matches.push(m)
  }
  return groups
}

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([])
  const [oddsByMatch, setOddsByMatch] = useState<Record<string, MatchOdds[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const nowIso = new Date().toISOString()
      const { data: ms } = await supabase
        .from('matches')
        .select('*')
        .eq('status', 'scheduled')
        .gt('commence_time', nowIso)
        .order('commence_time', { ascending: true })
        .limit(200)

      const list = (ms ?? []).map(localizeMatch)
      setMatches(list)

      if (list.length > 0) {
        const { data: odds } = await supabase
          .from('match_odds')
          .select('*')
          .in('match_id', list.map((m) => m.id))
        const grouped: Record<string, MatchOdds[]> = {}
        for (const o of odds ?? []) {
          ;(grouped[o.match_id] ??= []).push(o)
        }
        setOddsByMatch(grouped)
      }
      setLoading(false)
    }
    load()
  }, [])

  const groups = useMemo(() => groupByDay(matches), [matches])
  const visibleDays = groups.slice(0, VISIBLE_DAYS)
  const hiddenDays = groups.slice(VISIBLE_DAYS)

  if (loading) return <Spinner label="Cargando partidos..." />

  if (matches.length === 0) {
    return (
      <div className="card text-center text-sm text-slate-400">
        No hay partidos disponibles ahora mismo.
        <br />
        Ejecuta la sincronización de cuotas (o usa el seed de prueba).
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <p className="px-1 text-xs text-slate-500">
        Toca las cuotas para añadirlas a tu hoja. Combina varios partidos para una apuesta múltiple.
      </p>

      {/* Primeros días, abiertos */}
      {visibleDays.map((g) => (
        <div key={g.key} className="space-y-3">
          <h2 className="px-1 text-sm font-semibold capitalize text-slate-500 dark:text-slate-300">
            Partidos {g.label}
          </h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {g.matches.map((m) => (
              <MatchCard key={m.id} match={m} odds={oddsByMatch[m.id] ?? []} />
            ))}
          </div>
        </div>
      ))}

      {/* Resto de días, como desplegables */}
      {hiddenDays.length > 0 && (
        <div className="space-y-2 pt-1">
          {hiddenDays.map((g) => (
            <DaySection key={g.key} group={g} oddsByMatch={oddsByMatch} />
          ))}
        </div>
      )}
    </div>
  )
}

function DaySection({
  group,
  oddsByMatch,
}: {
  group: DayGroup
  oddsByMatch: Record<string, MatchOdds[]>
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between bg-slate-100 px-4 py-3 text-left transition hover:bg-slate-200 dark:bg-slate-800/50 dark:hover:bg-slate-800"
      >
        <span className="font-semibold capitalize text-slate-900 dark:text-white">Partidos {group.label}</span>
        <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs dark:bg-slate-700">{group.matches.length}</span>
          <span className="text-xs">{open ? '▲' : '▼'}</span>
        </span>
      </button>
      {open && (
        <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
          {group.matches.map((m) => (
            <MatchCard key={m.id} match={m} odds={oddsByMatch[m.id] ?? []} />
          ))}
        </div>
      )}
    </div>
  )
}

function MatchCard({ match, odds }: { match: Match; odds: MatchOdds[] }) {
  const { toggle, isSelected } = useBetSlip()
  const { league } = useLeague()
  const h2h = (sel: Selection) => odds.find((o) => o.market === 'h2h' && o.selection === sel)
  const totals = (sel: Selection) => odds.find((o) => o.market === 'totals' && o.selection === sel)
  const over = totals('over')
  const under = totals('under')

  const pick = (o: MatchOdds) =>
    toggle({ match, market: o.market, selection: o.selection, point: o.point, price: o.price })

  return (
    <div className="card">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs text-slate-500">{fmtDate(match.commence_time)}</span>
        <Countdown target={match.commence_time} />
      </div>
      <div className="mb-3 font-semibold text-slate-900 dark:text-white">
        {match.home_team} <span className="text-slate-500">vs</span> {match.away_team}
      </div>

      {/* Ganador del partido (sin etiquetas 1X2: nombre del equipo / Empate) */}
      <div className="grid grid-cols-3 gap-2">
        <OddsButton label={match.home_team} odds={h2h('home')} onPick={pick} selected={isSel(isSelected, h2h('home'))} />
        <OddsButton label="Empate" odds={h2h('draw')} onPick={pick} selected={isSel(isSelected, h2h('draw'))} />
        <OddsButton label={match.away_team} odds={h2h('away')} onPick={pick} selected={isSel(isSelected, h2h('away'))} />
      </div>

      {/* Over/Under */}
      {(over || under) && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <OddsButton
            label={`+${over?.point ?? under?.point} goles`}
            odds={over}
            onPick={pick}
            selected={isSel(isSelected, over)}
          />
          <OddsButton
            label={`-${under?.point ?? over?.point} goles`}
            odds={under}
            onPick={pick}
            selected={isSel(isSelected, under)}
          />
        </div>
      )}

      <Link
        to={`/l/${league.id}/partido/${match.id}`}
        className="mt-3 block text-center text-xs font-medium text-brand hover:underline"
      >
        Más apuestas ›
      </Link>
    </div>
  )
}

function isSel(
  isSelected: (m: string, mk: string, s: string, p: number) => boolean,
  o?: MatchOdds,
): boolean {
  return o ? isSelected(o.match_id, o.market, o.selection, o.point) : false
}

function OddsButton({
  label,
  odds,
  onPick,
  selected,
}: {
  label: string
  odds?: MatchOdds
  onPick: (o: MatchOdds) => void
  selected: boolean
}) {
  if (!odds) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-slate-100 px-1 py-2 text-slate-400 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-600">
        <span className="text-center text-xs leading-tight">{label}</span>
        <span className="text-sm">—</span>
      </div>
    )
  }
  return (
    <button
      onClick={() => onPick(odds)}
      className={`flex flex-col items-center justify-between gap-1 rounded-xl border px-1 py-2 transition active:scale-95 ${
        selected
          ? 'border-brand bg-brand/20'
          : 'border-slate-300 bg-slate-100 hover:border-brand dark:border-slate-700 dark:bg-slate-800'
      }`}
    >
      <span className="line-clamp-2 text-center text-xs leading-tight text-slate-500 dark:text-slate-400">{label}</span>
      <span className="font-bold text-brand">{fmtOdds(odds.price)}</span>
    </button>
  )
}
