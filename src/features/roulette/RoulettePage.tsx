import { useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { captureError } from '../../lib/monitoring'
import { fmtChips } from '../../lib/format'
import {
  CHIP_VALUES,
  WHEEL_ORDER,
  betWins,
  colorOf,
  keyToServerBet,
  shortChip,
} from '../../lib/roulette'
import { useLeague } from '../leagues/LeagueLayout'
import RouletteWheel from './RouletteWheel'

const STEP = 360 / WHEEL_ORDER.length

const TOP_ROW = Array.from({ length: 12 }, (_, i) => (i + 1) * 3) // 3,6,...,36
const MID_ROW = Array.from({ length: 12 }, (_, i) => (i + 1) * 3 - 1) // 2,5,...,35
const BOT_ROW = Array.from({ length: 12 }, (_, i) => (i + 1) * 3 - 2) // 1,4,...,34

const NUM_BG: Record<string, string> = {
  green: 'bg-[#15803d]',
  red: 'bg-[#c81e1e]',
  black: 'bg-[#1f2937]',
}

type Result = { number: number; net: number }

export default function RoulettePage() {
  const { league, balance } = useLeague()

  const [bets, setBets] = useState<Record<string, number>>({})
  const [chip, setChip] = useState(CHIP_VALUES[0])
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [rotation, setRotation] = useState(0)
  const [ballRot, setBallRot] = useState(0)
  const [spinKey, setSpinKey] = useState(0)
  const rotRef = useRef(0)
  const ballRef = useRef(0)

  const total = useMemo(() => Object.values(bets).reduce((s, x) => s + x, 0), [bets])
  const winningNumber = result?.number ?? null

  function place(key: string) {
    if (spinning) return
    if (total + chip > Number(balance)) {
      setError('No tienes fichas suficientes para esa apuesta')
      return
    }
    setError(null)
    setResult(null)
    setBets((b) => ({ ...b, [key]: (b[key] ?? 0) + chip }))
  }

  function clearBets() {
    if (spinning) return
    setBets({})
    setResult(null)
    setError(null)
  }

  async function spin() {
    if (spinning || total === 0) return
    setSpinning(true)
    setResult(null)
    setError(null)

    const serverBets = Object.entries(bets).map(([k, a]) => keyToServerBet(k, a))
    const { data, error } = await supabase.rpc('play_roulette', {
      p_league_id: league.id,
      p_bets: serverBets,
    })
    if (error || data == null) {
      setSpinning(false)
      captureError(error ?? new Error('play_roulette devolvió null'), 'play_roulette')
      setError(error?.message ?? 'No se pudo jugar la ruleta')
      return
    }
    const res = data as { number: number; payout: number; stake: number; balance: number }

    // Llevar la casilla ganadora arriba (bajo la flecha) + varias vueltas.
    const idx = WHEEL_ORDER.indexOf(res.number)
    const desired = (360 - ((idx * STEP) % 360) + 360) % 360
    const next = Math.ceil((rotRef.current + 360 * 6) / 360) * 360 + desired
    rotRef.current = next
    setRotation(next)
    // La bola orbita en sentido contrario y termina arriba, sobre la ganadora.
    ballRef.current -= 360 * 8
    setBallRot(ballRef.current)
    setSpinKey((k) => k + 1)

    window.setTimeout(() => {
      setSpinning(false)
      setResult({ number: res.number, net: res.payout - res.stake })
      setBets({}) // las fichas ya se resolvieron en el servidor
    }, 5000)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">🎰 Ruleta</h1>
        <div className="text-right">
          <div className="font-bold leading-none text-brand">{fmtChips(balance)}</div>
          <div className="text-[10px] text-slate-500">fichas</div>
        </div>
      </div>

      <RouletteWheel rotation={rotation} ballRot={ballRot} spinning={spinning} spinKey={spinKey} />

      {/* Resultado de la última tirada */}
      {result && (
        <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center dark:border-slate-700 dark:bg-slate-900">
          <span className="text-sm text-slate-500 dark:text-slate-400">Salió el </span>
          <span
            className={`mx-1 inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold text-white ${NUM_BG[colorOf(result.number)]}`}
          >
            {result.number}
          </span>
          <span className="ml-1 text-sm font-semibold">
            {result.net > 0 ? (
              <span className="text-emerald-600 dark:text-emerald-400">
                ¡Ganaste +{fmtChips(result.net)}!
              </span>
            ) : result.net < 0 ? (
              <span className="text-red-500">Perdiste {fmtChips(-result.net)}</span>
            ) : (
              <span className="text-slate-500">Recuperaste tu apuesta</span>
            )}
          </span>
        </div>
      )}

      {error && <p className="text-center text-sm text-red-500">{error}</p>}

      {/* Mesa de apuestas (estilo casino) */}
      <div className="overflow-x-auto">
        <div className="mx-auto min-w-[320px] max-w-xl space-y-1 rounded-xl bg-[#0e5a34] p-1.5">
          {/* Números 0-36 + columnas (2 a 1) */}
          <div className="flex gap-px">
            <Cell
              betKey="n:0"
              bets={bets}
              winningNumber={winningNumber}
              spinning={spinning}
              onPlace={place}
              className={`w-7 shrink-0 self-stretch ${NUM_BG.green}`}
            >
              0
            </Cell>

            <div className="grid flex-1 grid-cols-12 gap-px">
              {TOP_ROW.map((n) => (
                <NumberCell key={n} n={n} bets={bets} winningNumber={winningNumber} spinning={spinning} onPlace={place} />
              ))}
              {MID_ROW.map((n) => (
                <NumberCell key={n} n={n} bets={bets} winningNumber={winningNumber} spinning={spinning} onPlace={place} />
              ))}
              {BOT_ROW.map((n) => (
                <NumberCell key={n} n={n} bets={bets} winningNumber={winningNumber} spinning={spinning} onPlace={place} />
              ))}
            </div>

            <div className="flex w-10 shrink-0 flex-col gap-px">
              {[3, 2, 1].map((c) => (
                <Cell
                  key={c}
                  betKey={`column:${c}`}
                  bets={bets}
                  winningNumber={winningNumber}
                  spinning={spinning}
                  onPlace={place}
                  className="h-8 bg-[#0b7a43] text-[9px] leading-tight"
                >
                  2 a 1
                </Cell>
              ))}
            </div>
          </div>

          {/* Docenas */}
          <div className="flex gap-px">
            <div className="w-7 shrink-0" aria-hidden />
            <div className="grid flex-1 grid-cols-3 gap-px">
              <Cell betKey="dozen:1" bets={bets} winningNumber={winningNumber} spinning={spinning} onPlace={place} className="h-9 bg-[#0b7a43] text-[10px]">
                1-12
              </Cell>
              <Cell betKey="dozen:2" bets={bets} winningNumber={winningNumber} spinning={spinning} onPlace={place} className="h-9 bg-[#0b7a43] text-[10px]">
                13-24
              </Cell>
              <Cell betKey="dozen:3" bets={bets} winningNumber={winningNumber} spinning={spinning} onPlace={place} className="h-9 bg-[#0b7a43] text-[10px]">
                25-36
              </Cell>
            </div>
            <div className="w-10 shrink-0" aria-hidden />
          </div>

          {/* Apuestas exteriores simples */}
          <div className="flex gap-px">
            <div className="w-7 shrink-0" aria-hidden />
            <div className="grid flex-1 grid-cols-6 gap-px">
              <Cell betKey="low" bets={bets} winningNumber={winningNumber} spinning={spinning} onPlace={place} className="h-9 bg-[#0b7a43] text-[10px]">
                1-18
              </Cell>
              <Cell betKey="even" bets={bets} winningNumber={winningNumber} spinning={spinning} onPlace={place} className="h-9 bg-[#0b7a43] text-[10px]">
                PAR
              </Cell>
              <Cell betKey="red" bets={bets} winningNumber={winningNumber} spinning={spinning} onPlace={place} className="h-9 bg-[#c81e1e] text-base">
                ◆
              </Cell>
              <Cell betKey="black" bets={bets} winningNumber={winningNumber} spinning={spinning} onPlace={place} className="h-9 bg-[#1f2937] text-base">
                ◆
              </Cell>
              <Cell betKey="odd" bets={bets} winningNumber={winningNumber} spinning={spinning} onPlace={place} className="h-9 bg-[#0b7a43] text-[10px]">
                IMPAR
              </Cell>
              <Cell betKey="high" bets={bets} winningNumber={winningNumber} spinning={spinning} onPlace={place} className="h-9 bg-[#0b7a43] text-[10px]">
                19-36
              </Cell>
            </div>
            <div className="w-10 shrink-0" aria-hidden />
          </div>
        </div>
      </div>

      {/* Selector de ficha */}
      <div>
        <div className="mb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
          Ficha seleccionada
        </div>
        <div className="flex flex-wrap gap-2">
          {CHIP_VALUES.map((v) => (
            <button
              key={v}
              onClick={() => setChip(v)}
              disabled={spinning}
              className={`flex h-11 w-11 items-center justify-center rounded-full border-2 text-xs font-bold transition disabled:opacity-50 ${
                chip === v
                  ? 'scale-110 border-amber-300 bg-amber-400 text-slate-900 shadow'
                  : 'border-slate-300 bg-white text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'
              }`}
            >
              {shortChip(v)}
            </button>
          ))}
        </div>
      </div>

      {/* Total y acciones */}
      <div className="flex items-center justify-between rounded-xl bg-slate-100 px-4 py-2.5 text-sm dark:bg-slate-800">
        <span className="text-slate-500 dark:text-slate-400">Total apostado</span>
        <span className="font-bold text-slate-900 dark:text-white">{fmtChips(total)} fichas</span>
      </div>

      <div className="grid grid-cols-[1fr_2fr] gap-3">
        <button className="btn-ghost" onClick={clearBets} disabled={spinning || total === 0}>
          Limpiar
        </button>
        <button className="btn-primary" onClick={spin} disabled={spinning || total === 0}>
          {spinning ? 'Girando...' : '🎯 Girar'}
        </button>
      </div>

      <p className="text-center text-[11px] text-slate-400">
        Pleno 35:1 · Docena y columna 2:1 · Color, par/impar y mitades 1:1
      </p>
    </div>
  )
}

function NumberCell({
  n,
  bets,
  winningNumber,
  spinning,
  onPlace,
}: {
  n: number
  bets: Record<string, number>
  winningNumber: number | null
  spinning: boolean
  onPlace: (key: string) => void
}) {
  return (
    <Cell
      betKey={`n:${n}`}
      bets={bets}
      winningNumber={winningNumber}
      spinning={spinning}
      onPlace={onPlace}
      className={`h-8 text-[11px] ${NUM_BG[colorOf(n)]}`}
    >
      {n}
    </Cell>
  )
}

function Cell({
  betKey,
  bets,
  winningNumber,
  spinning,
  onPlace,
  className = '',
  children,
}: {
  betKey: string
  bets: Record<string, number>
  winningNumber: number | null
  spinning: boolean
  onPlace: (key: string) => void
  className?: string
  children: React.ReactNode
}) {
  const amount = bets[betKey]
  const win = winningNumber != null && betWins(betKey, winningNumber)
  return (
    <button
      type="button"
      onClick={() => onPlace(betKey)}
      disabled={spinning}
      className={`relative flex items-center justify-center rounded-[3px] font-bold text-white transition active:brightness-110 disabled:cursor-default ${
        win ? 'z-10 ring-2 ring-yellow-300' : ''
      } ${className}`}
    >
      {children}
      {amount != null && (
        <span className="absolute -bottom-1 -right-1 z-20 flex h-4 min-w-[16px] items-center justify-center rounded-full border border-white bg-amber-400 px-0.5 text-[8px] font-bold text-slate-900">
          {shortChip(amount)}
        </span>
      )}
    </button>
  )
}
