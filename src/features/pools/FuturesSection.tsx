import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useLeague } from '../leagues/LeagueLayout'
import { fmtChips, fmtOdds } from '../../lib/format'
import type { FutureOdd, FuturesBet, Profile } from '../../lib/database.types'
import { captureError } from '../../lib/monitoring'
import Avatar from '../../components/Avatar'

type Prof = Pick<Profile, 'id' | 'display_name' | 'avatar_url'>
const MARKET = 'champion'

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pendiente', cls: 'text-slate-500' },
  won: { label: 'Ganada', cls: 'text-brand' },
  lost: { label: 'Perdida', cls: 'text-red-400' },
}

export default function FuturesSection() {
  const { league, balance, userId } = useLeague()
  const isOwner = league.owner_id === userId
  const [odds, setOdds] = useState<FutureOdd[]>([])
  const [bets, setBets] = useState<FuturesBet[]>([])
  const [profiles, setProfiles] = useState<Map<string, Prof>>(new Map())
  const [sel, setSel] = useState('')
  const [stake, setStake] = useState(100)
  const [winner, setWinner] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mine = bets.find((b) => b.user_id === userId) ?? null

  const load = useCallback(async () => {
    const { data: o } = await supabase
      .from('future_odds')
      .select('*')
      .eq('market', MARKET)
      .order('sort', { ascending: true })
    setOdds((o ?? []) as FutureOdd[])

    const { data: b } = await supabase
      .from('futures_bets')
      .select('*')
      .eq('league_id', league.id)
      .eq('market', MARKET)
    const list = (b ?? []) as FuturesBet[]
    setBets(list)
    if (list.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', list.map((x) => x.user_id))
      setProfiles(new Map((profs ?? []).map((p) => [p.id, p as Prof])))
    }
  }, [league.id])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const channel = supabase
      .channel(`futures-${league.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'futures_bets', filter: `league_id=eq.${league.id}` }, () => load())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [league.id, load])

  async function place() {
    if (!sel) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.rpc('place_future', {
      p_league_id: league.id,
      p_market: MARKET,
      p_selection: sel,
      p_stake: stake,
    })
    setBusy(false)
    if (error) {
      captureError(error, 'place_future')
      return setError(error.message)
    }
    load()
  }

  async function settle() {
    if (!winner) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.rpc('settle_future', {
      p_league_id: league.id,
      p_market: MARKET,
      p_winner: winner,
    })
    setBusy(false)
    if (error) {
      captureError(error, 'settle_future')
      return setError(error.message)
    }
    load()
  }

  const settled = bets.length > 0 && bets.every((b) => b.status !== 'pending')
  const selectedOdd = odds.find((o) => o.selection === sel)

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-900 dark:text-white">🏆 ¿Quién gana el Mundial?</h2>
        <span className="text-xs text-slate-400">Apuesta de futuro</span>
      </div>

      {mine ? (
        <div className="flex items-center justify-between rounded-xl bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">
          <span className="text-slate-700 dark:text-slate-200">
            Tu apuesta: <span className="font-semibold">{mine.label}</span> @ {fmtOdds(mine.odds_taken)}
          </span>
          <span className={`font-semibold ${STATUS[mine.status].cls}`}>{STATUS[mine.status].label}</span>
        </div>
      ) : (
        <div className="space-y-2">
          <select className="input" value={sel} onChange={(e) => setSel(e.target.value)}>
            <option value="">Elige campeón…</option>
            {odds.map((o) => (
              <option key={o.selection} value={o.selection}>
                {o.label} (@ {fmtOdds(o.price)})
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              className="input flex-1"
              value={stake}
              onChange={(e) => setStake(Math.max(1, Math.floor(Number(e.target.value))))}
            />
            <button className="btn-primary shrink-0 px-4" disabled={busy || !sel || stake > balance} onClick={place}>
              Apostar
            </button>
          </div>
          {selectedOdd && (
            <p className="text-xs text-slate-500">
              Premio posible: {fmtChips(stake * selectedOdd.price)} fichas
            </p>
          )}
        </div>
      )}

      {/* Picks de la liga */}
      {bets.length > 0 && (
        <div className="space-y-1 border-t border-slate-200 pt-2 dark:border-slate-800">
          {bets.map((b) => {
            const p = profiles.get(b.user_id)
            return (
              <div key={b.id} className="flex items-center gap-2 text-sm">
                <Avatar url={p?.avatar_url} name={p?.display_name} size={22} />
                <span className="min-w-0 flex-1 truncate text-slate-600 dark:text-slate-300">{p?.display_name ?? '—'}</span>
                <span className="shrink-0 font-medium text-slate-900 dark:text-white">{b.label}</span>
                <span className={`shrink-0 text-xs ${STATUS[b.status].cls}`}>{STATUS[b.status].label}</span>
              </div>
            )
          })}
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {/* Liquidación del owner */}
      {isOwner && bets.length > 0 && !settled && (
        <div className="flex items-center gap-2 border-t border-amber-400/40 pt-2">
          <select className="input flex-1" value={winner} onChange={(e) => setWinner(e.target.value)}>
            <option value="">Campeón real…</option>
            {odds.map((o) => (
              <option key={o.selection} value={o.selection}>
                {o.label}
              </option>
            ))}
          </select>
          <button className="btn-primary shrink-0 px-4" disabled={busy || !winner} onClick={settle}>
            Liquidar
          </button>
        </div>
      )}
    </div>
  )
}
