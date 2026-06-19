import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useLeague } from '../leagues/LeagueLayout'
import { fmtChips, fmtOdds, legText } from '../../lib/format'
import type { Bet, BetLeg } from '../../lib/database.types'
import { localizeMatch, withFlag } from '../../lib/teams'
import Spinner from '../../components/Spinner'
import { isLiveBet, passesFilter, type BetRow, type LegRow, type Filter } from './filters'
import { captureError } from '../../lib/monitoring'
import { ShareTicket, shareTicket } from './ShareTicket'

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-slate-700 text-slate-200',
  won: 'bg-brand text-slate-900',
  lost: 'bg-red-900/60 text-red-300',
  void: 'bg-amber-800/60 text-amber-200',
  cashed_out: 'bg-sky-800/70 text-sky-200',
}
const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  won: 'Ganada',
  lost: 'Perdida',
  void: 'Anulada',
  cashed_out: 'Retirada',
}
const LEG_ICON: Record<string, string> = { pending: '•', won: '✓', lost: '✗', void: '↩' }
const LEG_COLOR: Record<string, string> = {
  pending: 'text-slate-500',
  won: 'text-brand',
  lost: 'text-red-400',
  void: 'text-amber-300',
}

export default function MyBetsPage() {
  const { league, userId } = useLeague()
  const [bets, setBets] = useState<BetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [cashout, setCashout] = useState<BetRow | null>(null)
  const [filter, setFilter] = useState<Filter>('all')

  const load = useCallback(async () => {
    const { data: bs } = await supabase
      .from('bets')
      .select('*')
      .eq('league_id', league.id)
      .eq('user_id', userId)
      .order('placed_at', { ascending: false })
    const list = (bs ?? []) as Bet[]
    if (list.length === 0) {
      setBets([])
      setLoading(false)
      return
    }

    const { data: legsData } = await supabase
      .from('bet_legs')
      .select('*')
      .in('bet_id', list.map((b) => b.id))
    const legs = (legsData ?? []) as BetLeg[]

    const matchIds = [...new Set(legs.map((l) => l.match_id))]
    const { data: ms } = await supabase.from('matches').select('*').in('id', matchIds)
    const byMatch = new Map((ms ?? []).map(localizeMatch).map((m) => [m.id, m]))

    const legsByBet = new Map<string, LegRow[]>()
    for (const l of legs) {
      ;(legsByBet.get(l.bet_id) ?? legsByBet.set(l.bet_id, []).get(l.bet_id)!).push({
        ...l,
        match: byMatch.get(l.match_id),
      })
    }

    setBets(list.map((b) => ({ ...b, legs: legsByBet.get(b.id) ?? [] })))
    setLoading(false)
  }, [league.id, userId])

  useEffect(() => {
    load()
  }, [load])

  // Refresca al liquidar/retirar (realtime sobre las apuestas de la liga)
  useEffect(() => {
    const channel = supabase
      .channel(`mybets-${league.id}-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bets', filter: `league_id=eq.${league.id}` },
        () => load(),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [league.id, userId, load])

  if (loading) return <Spinner />
  if (bets.length === 0)
    return <div className="card text-center text-sm text-slate-500 dark:text-slate-400">Aún no has hecho apuestas.</div>

  const filtered = bets.filter((b) => passesFilter(b, filter))

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <FilterBtn active={filter === 'all'} onClick={() => setFilter('all')}>Todas</FilterBtn>
        <FilterBtn active={filter === 'pending'} onClick={() => setFilter('pending')}>Pendientes</FilterBtn>
        <FilterBtn active={filter === 'won'} onClick={() => setFilter('won')}>
          <span className="text-brand">✓</span> Ganadas
        </FilterBtn>
        <FilterBtn active={filter === 'closed'} onClick={() => setFilter('closed')}>Cerradas</FilterBtn>
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center text-sm text-slate-500 dark:text-slate-400">
          No hay apuestas en esta categoría.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((b) => (
            <BetCard key={b.id} bet={b} onCashout={() => setCashout(b)} />
          ))}
        </div>
      )}

      {cashout && (
        <CashoutModal
          bet={cashout}
          onClose={() => setCashout(null)}
          onDone={() => {
            setCashout(null)
            load()
          }}
        />
      )}
    </div>
  )
}

function FilterBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
        active
          ? 'bg-brand text-slate-900'
          : 'bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
      }`}
    >
      {children}
    </button>
  )
}

function LiveDot() {
  return <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
}

function BetCard({ bet, onCashout }: { bet: BetRow; onCashout: () => void }) {
  const isCombo = bet.num_legs > 1
  const live = isLiveBet(bet)
  const ticketRef = useRef<HTMLDivElement>(null)
  const [sharing, setSharing] = useState(false)

  async function share() {
    if (!ticketRef.current) return
    setSharing(true)
    try {
      await shareTicket(ticketRef.current)
    } catch (e) {
      captureError(e, 'share_ticket')
      const msg = e instanceof Error ? e.message : 'No se pudo compartir el boleto'
      alert(msg)
    } finally {
      setSharing(false)
    }
  }

  // Solo se puede retirar (devolución íntegra) si NINGÚN partido ha empezado.
  const notStarted =
    bet.legs.length > 0 &&
    bet.legs.every(
      (l) =>
        l.match &&
        l.match.status === 'scheduled' &&
        new Date(l.match.commence_time).getTime() > Date.now(),
    )
  return (
    <div className="card">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-900 dark:text-white">
          {isCombo ? `Combinada · ${bet.num_legs} partidos` : 'Apuesta simple'}
        </span>
        {live ? (
          <span className="flex items-center gap-1.5 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-500 dark:text-red-400">
            <LiveDot /> En directo
          </span>
        ) : (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[bet.status]}`}
          >
            {STATUS_LABEL[bet.status]}
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        {bet.legs.map((l) => (
          <div key={l.id} className="flex items-center justify-between text-sm">
            <div className="min-w-0">
              <div className="truncate text-[11px] text-slate-500">
                {l.match ? `${withFlag(l.match.home_team)} vs ${withFlag(l.match.away_team)}` : l.match_id}
                {l.match?.status === 'finished' && (
                  <span className="ml-1 text-slate-400">
                    ({l.match.home_score}-{l.match.away_score})
                  </span>
                )}
              </div>
              <div className="truncate text-slate-900 dark:text-white">
                <span className={`mr-1 ${LEG_COLOR[l.status]}`}>{LEG_ICON[l.status]}</span>
                {l.match
                  ? legText(
                      { market: l.market, selection: l.selection, point: l.point, label: l.label, playerName: l.player_name },
                      l.match.home_team,
                      l.match.away_team,
                    )
                  : l.label ?? `${l.selection} ${l.point}`}
              </div>
            </div>
            <span className="ml-2 shrink-0 text-slate-400">{fmtOdds(l.odds_taken)}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-2 text-sm dark:border-slate-800">
        <span className="text-slate-400">
          Apostado: {fmtChips(bet.stake)}
          {isCombo && bet.combined_odds != null && (
            <span className="text-slate-500"> · @ {fmtOdds(bet.combined_odds)}</span>
          )}
        </span>
        <Outcome bet={bet} />
      </div>

      {bet.status === 'pending' &&
        (notStarted ? (
          <button onClick={onCashout} className="btn-ghost mt-3 w-full py-2 text-sm">
            💸 Retirar (devolución íntegra)
          </button>
        ) : (
          <p className="mt-3 text-center text-xs text-slate-500">
            No se puede retirar: el partido ya ha empezado
          </p>
        ))}

      <button onClick={share} disabled={sharing} className="btn-ghost mt-2 w-full py-2 text-sm">
        {sharing ? '...' : '📲 Compartir boleto'}
      </button>

      {/* Boleto oculto que se captura como imagen al compartir */}
      <ShareTicket ref={ticketRef} bet={bet} />
    </div>
  )
}

function Outcome({ bet }: { bet: BetRow }) {
  if (bet.status === 'won')
    return <span className="font-bold text-brand">+{fmtChips(bet.settled_payout ?? bet.potential_payout)}</span>
  if (bet.status === 'void')
    return <span className="text-amber-300">Devuelto {fmtChips(bet.stake)}</span>
  if (bet.status === 'cashed_out')
    return <span className="font-bold text-sky-300">Retirado {fmtChips(bet.cashout_value ?? 0)}</span>
  if (bet.status === 'lost') return <span className="text-red-400">—</span>
  return <span className="text-slate-400">Posible: {fmtChips(bet.potential_payout)}</span>
}

// --- Modal de retirada (solo pre-partido: devolución íntegra) ----------------
function CashoutModal({
  bet,
  onClose,
  onDone,
}: {
  bet: BetRow
  onClose: () => void
  onDone: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function confirm() {
    setBusy(true)
    setError(null)
    const { error } = await supabase.rpc('cashout_prematch', { p_bet_id: bet.id })
    setBusy(false)
    if (error) {
      captureError(error, 'cashout_prematch')
      return setError(error.message)
    }
    setDone(true)
    setTimeout(onDone, 1100)
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 md:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl border-t border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900 md:rounded-3xl md:border"
        style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />

        {done ? (
          <div className="py-8 text-center">
            <div className="text-4xl">💸</div>
            <p className="mt-2 font-semibold text-slate-900 dark:text-white">¡Apuesta retirada!</p>
          </div>
        ) : (
          <>
            <h3 className="mb-1 font-semibold text-slate-900 dark:text-white">Retirar apuesta</h3>
            <p className="mb-4 text-sm text-slate-400">
              Como el partido aún no ha empezado, se te devuelve el{' '}
              <span className="font-semibold text-slate-900 dark:text-white">importe íntegro</span>.
            </p>

            <div className="mb-4 rounded-xl bg-slate-100 px-4 py-4 text-center dark:bg-slate-800">
              <div className="text-xs text-slate-400">Recibirás</div>
              <div className="text-3xl font-bold text-sky-300">{fmtChips(bet.stake)}</div>
              <div className="text-xs text-slate-500">fichas</div>
            </div>

            {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

            <div className="flex gap-2">
              <button className="btn-ghost flex-1 py-2.5" onClick={onClose} disabled={busy}>
                Cancelar
              </button>
              <button className="btn-primary flex-1 py-2.5" onClick={confirm} disabled={busy}>
                {busy ? '...' : `Retirar ${fmtChips(bet.stake)}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
