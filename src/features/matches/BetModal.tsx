import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useLeague } from '../leagues/LeagueLayout'
import { fmtChips, fmtOdds, SELECTION_LABEL } from '../../lib/format'
import type { Match, Market, Selection } from '../../lib/database.types'

export interface BetDraft {
  match: Match
  market: Market
  selection: Selection
  point: number
  price: number
}

const QUICK = [10, 50, 100, 250]

export default function BetModal({ draft, onClose }: { draft: BetDraft; onClose: () => void }) {
  const { league, balance } = useLeague()
  const [stake, setStake] = useState<number>(50)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const payout = stake * draft.price
  const selLabel =
    draft.market === 'h2h'
      ? `${SELECTION_LABEL[draft.selection]} (${
          draft.selection === 'home'
            ? draft.match.home_team
            : draft.selection === 'away'
              ? draft.match.away_team
              : 'Empate'
        })`
      : `${SELECTION_LABEL[draft.selection]} ${draft.point} goles`

  async function confirm() {
    setBusy(true)
    setError(null)
    const { error } = await supabase.rpc('place_bet', {
      p_league_id: league.id,
      p_match_id: draft.match.id,
      p_market: draft.market,
      p_selection: draft.selection,
      p_point: draft.point,
      p_stake: stake,
    })
    setBusy(false)
    if (error) return setError(error.message)
    setDone(true)
    setTimeout(onClose, 900)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl border-t border-slate-700 bg-slate-900 p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-700" />

        {done ? (
          <div className="py-8 text-center">
            <div className="text-4xl">✅</div>
            <p className="mt-2 font-semibold text-white">¡Apuesta realizada!</p>
          </div>
        ) : (
          <>
            <div className="mb-1 text-sm text-slate-400">
              {draft.match.home_team} vs {draft.match.away_team}
            </div>
            <div className="mb-4 flex items-center justify-between">
              <span className="font-semibold text-white">{selLabel}</span>
              <span className="font-bold text-brand">{fmtOdds(draft.price)}</span>
            </div>

            <label className="label">Fichas a apostar</label>
            <input
              type="number"
              className="input mb-2"
              min={1}
              max={balance}
              value={stake}
              onChange={(e) => setStake(Math.max(0, Math.floor(Number(e.target.value))))}
            />
            <div className="mb-4 grid grid-cols-4 gap-2">
              {QUICK.map((q) => (
                <button
                  key={q}
                  className="btn-ghost py-1.5 text-sm"
                  onClick={() => setStake(Math.min(q, balance))}
                >
                  {q}
                </button>
              ))}
            </div>

            <div className="mb-4 flex items-center justify-between rounded-xl bg-slate-800 px-4 py-3 text-sm">
              <span className="text-slate-400">Ganancia potencial</span>
              <span className="font-bold text-white">{fmtChips(payout)} fichas</span>
            </div>

            {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

            <button
              className="btn-primary w-full"
              disabled={busy || stake <= 0 || stake > balance}
              onClick={confirm}
            >
              {busy ? '...' : stake > balance ? 'Fichas insuficientes' : `Apostar ${fmtChips(stake)} fichas`}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
