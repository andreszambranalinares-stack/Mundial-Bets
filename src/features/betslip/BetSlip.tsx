import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useBetSlip } from './BetSlipProvider'
import { fmtChips, fmtOdds, legText } from '../../lib/format'
import { withFlag } from '../../lib/teams'
import type { League } from '../../lib/database.types'
import { combinedOdds } from './calc'
import { captureError } from '../../lib/monitoring'

const QUICK = [10, 50, 100, 250]

export default function BetSlip({ league, balance }: { league: League; balance: number }) {
  const { legs, toggle, clear } = useBetSlip()
  const [open, setOpen] = useState(false)
  const [stake, setStake] = useState(50)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  if (legs.length === 0) return null

  const combined = combinedOdds(legs)
  const payout = stake * combined
  const isCombo = legs.length > 1

  async function place() {
    setBusy(true)
    setError(null)
    const { error } = await supabase.rpc('place_combo_bet', {
      p_league_id: league.id,
      p_stake: stake,
      p_legs: legs.map((l) => ({
        match_id: l.match.id,
        market: l.market,
        selection: l.selection,
        point: l.point,
        ...(l.playerName ? { player_name: l.playerName } : {}),
      })),
    })
    setBusy(false)
    if (error) {
      captureError(error, 'place_combo_bet')
      return setError(error.message)
    }
    setDone(true)
    setTimeout(() => {
      setDone(false)
      setOpen(false)
      clear()
    }, 1100)
  }

  return (
    <>
      {/* Barra flotante (encima de la navegación inferior) */}
      {!open && !done && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-24 left-1/2 z-20 flex w-[calc(100%-2rem)] max-w-[28rem] -translate-x-1/2 items-center justify-between rounded-2xl bg-brand px-4 py-3 font-semibold text-slate-900 shadow-lg shadow-black/40 transition active:scale-[0.98] md:bottom-6"
        >
          <span>
            🎫 {legs.length} {isCombo ? `selecciones · combinada` : 'selección'}
          </span>
          <span className="flex items-center gap-2">
            <span className="rounded-lg bg-slate-900/15 px-2 py-0.5">@ {fmtOdds(combined)}</span>
            <span>Apostar ›</span>
          </span>
        </button>
      )}

      {/* Hoja desplegada */}
      {open && (
        <div
          className="fixed inset-0 z-30 flex items-end justify-center bg-black/60 md:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl border-t border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900 md:rounded-3xl md:border"
            style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />

            {done ? (
              <div className="py-8 text-center">
                <div className="text-4xl">✅</div>
                <p className="mt-2 font-semibold text-slate-900 dark:text-white">
                  ¡{isCombo ? 'Combinada' : 'Apuesta'} realizada!
                </p>
              </div>
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {isCombo ? `Combinada · ${legs.length} selecciones` : 'Tu apuesta'}
                  </span>
                  <button onClick={clear} className="text-xs text-slate-500 hover:text-red-400">
                    Vaciar
                  </button>
                </div>

                <div className="mb-4 max-h-56 space-y-2 overflow-y-auto">
                  {legs.map((l) => (
                    <div
                      key={`${l.match.id}|${l.market}|${l.selection}|${l.point}|${l.playerName ?? ''}`}
                      className="flex items-center justify-between rounded-xl bg-slate-100 px-3 py-2 dark:bg-slate-800"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-xs text-slate-500">
                          {withFlag(l.match.home_team)} vs {withFlag(l.match.away_team)}
                        </div>
                        <div className="truncate text-sm font-medium text-slate-900 dark:text-white">
                          {legText(
                            { market: l.market, selection: l.selection, point: l.point, label: l.label, playerName: l.playerName },
                            l.match.home_team,
                            l.match.away_team,
                          )}
                        </div>
                      </div>
                      <div className="ml-2 flex items-center gap-3">
                        <span className="font-bold text-brand">{fmtOdds(l.price)}</span>
                        <button
                          onClick={() => toggle(l)}
                          className="text-slate-500 hover:text-red-400"
                          aria-label="Quitar"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {isCombo && (
                  <div className="mb-4 flex items-center justify-between rounded-xl border border-brand/40 bg-brand/10 px-4 py-2 text-sm">
                    <span className="text-slate-300">Cuota combinada</span>
                    <span className="font-bold text-brand">{fmtOdds(combined)}</span>
                  </div>
                )}

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

                <div className="mb-4 flex items-center justify-between rounded-xl bg-slate-100 px-4 py-3 text-sm dark:bg-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Ganancia potencial</span>
                  <span className="font-bold text-slate-900 dark:text-white">{fmtChips(payout)} fichas</span>
                </div>

                {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

                <button
                  className="btn-primary w-full"
                  disabled={busy || stake <= 0 || stake > balance}
                  onClick={place}
                >
                  {busy
                    ? '...'
                    : stake > balance
                      ? 'Fichas insuficientes'
                      : `Apostar ${fmtChips(stake)} fichas`}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
