import { useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { captureError } from '../../lib/monitoring'
import { fmtChips } from '../../lib/format'
import { CHIP_VALUES, betWins, colorOf, gkey, keyToServerBet, shortChip } from '../../lib/roulette'
import { useLeague } from '../leagues/LeagueLayout'
import RouletteWheel from './RouletteWheel'

const TOP_ROW = Array.from({ length: 12 }, (_, i) => (i + 1) * 3) // 3,6,...,36
const MID_ROW = Array.from({ length: 12 }, (_, i) => (i + 1) * 3 - 1) // 2,5,...,35
const BOT_ROW = Array.from({ length: 12 }, (_, i) => (i + 1) * 3 - 2) // 1,4,...,34

const NUM_BG: Record<string, string> = {
  green: 'bg-[#15803d]',
  red: 'bg-[#c81e1e]',
  black: 'bg-[#1f2937]',
}

// --- Geometría de la rejilla de números (12 columnas x 3 filas) ---------------
const COLS = 12
const ROWS = 3
// Número en la columna c (0..11) y fila r (0..2): fila de arriba 3,6,..; etc.
const val = (c: number, r: number) => 3 * c + (3 - r)
const colNums = (c: number) => [val(c, 0), val(c, 1), val(c, 2)]
const px = (units: number) => (units / COLS) * 100
const py = (units: number) => (units / ROWS) * 100

type Spot = { key: string; x: number; y: number }

// Puntos clicables en bordes y esquinas para las apuestas interiores.
const SPOTS: Spot[] = (() => {
  const s: Spot[] = []
  // Caballos horizontales (dos números de la misma fila).
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS - 1; c++)
      s.push({ key: gkey([val(c, r), val(c + 1, r)]), x: px(c + 1), y: py(r + 0.5) })
  // Caballos verticales (dos números de la misma columna).
  for (let c = 0; c < COLS; c++)
    for (let r = 0; r < ROWS - 1; r++)
      s.push({ key: gkey([val(c, r), val(c, r + 1)]), x: px(c + 0.5), y: py(r + 1) })
  // Cuadros / esquinas (cuatro números).
  for (let r = 0; r < ROWS - 1; r++)
    for (let c = 0; c < COLS - 1; c++)
      s.push({
        key: gkey([val(c, r), val(c + 1, r), val(c, r + 1), val(c + 1, r + 1)]),
        x: px(c + 1),
        y: py(r + 1),
      })
  // Calles (los tres números de una columna), en el borde inferior.
  for (let c = 0; c < COLS; c++) s.push({ key: gkey(colNums(c)), x: px(c + 0.5), y: 96 })
  // Líneas / seisenas (seis números de dos columnas), en el borde inferior.
  for (let c = 0; c < COLS - 1; c++)
    s.push({ key: gkey([...colNums(c), ...colNums(c + 1)]), x: px(c + 1), y: 96 })
  // Apuestas con el 0 (borde izquierdo) + basket.
  s.push({ key: gkey([0, 3]), x: 1.5, y: py(0.5) })
  s.push({ key: gkey([0, 2]), x: 1.5, y: py(1.5) })
  s.push({ key: gkey([0, 1]), x: 1.5, y: py(2.5) })
  s.push({ key: gkey([0, 1, 2, 3]), x: 1.5, y: 4 })
  return s
})()

type Result = { number: number; net: number }

export default function RoulettePage() {
  const { league, balance } = useLeague()

  const [bets, setBets] = useState<Record<string, number>>({})
  const [chip, setChip] = useState(CHIP_VALUES[0])
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)

  // La rueda gira sola; al apostar incrementamos spinToken para lanzar la bola.
  const [spinToken, setSpinToken] = useState(0)
  const [targetNumber, setTargetNumber] = useState<number | null>(null)
  const pendingResult = useRef<Result | null>(null)

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

    // Lanzamos la bola hacia el número ganador; el resultado se revela en onSettled.
    pendingResult.current = { number: res.number, net: res.payout - res.stake }
    setTargetNumber(res.number)
    setSpinToken((t) => t + 1)
  }

  function onSettled() {
    setSpinning(false)
    if (pendingResult.current) setResult(pendingResult.current)
    setBets({}) // las fichas ya se resolvieron en el servidor
  }

  const cellProps = { bets, winningNumber, spinning, onPlace: place }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">🎰 Ruleta</h1>
        <div className="text-right">
          <div className="font-bold leading-none text-brand">{fmtChips(balance)}</div>
          <div className="text-[10px] text-slate-500">fichas</div>
        </div>
      </div>

      <RouletteWheel spinToken={spinToken} targetNumber={targetNumber} onSettled={onSettled} />

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
        <div className="mx-auto min-w-[460px] max-w-xl space-y-1 rounded-xl bg-[#0e5a34] p-1.5">
          {/* Números 0-36 + columnas (2 a 1) */}
          <div className="flex gap-px">
            <Cell {...cellProps} betKey="g:0" className={`w-8 shrink-0 self-stretch ${NUM_BG.green}`}>
              0
            </Cell>

            {/* Rejilla de números con la capa de puntos (caballo, calle, etc.) */}
            <div className="relative flex-1">
              <div className="grid grid-cols-12 gap-px">
                {TOP_ROW.map((n) => (
                  <NumberCell key={n} n={n} {...cellProps} />
                ))}
                {MID_ROW.map((n) => (
                  <NumberCell key={n} n={n} {...cellProps} />
                ))}
                {BOT_ROW.map((n) => (
                  <NumberCell key={n} n={n} {...cellProps} />
                ))}
              </div>
              <div className="pointer-events-none absolute inset-0">
                {SPOTS.map((sp) => (
                  <Hotspot key={sp.key} sp={sp} {...cellProps} />
                ))}
              </div>
            </div>

            <div className="flex w-11 shrink-0 flex-col gap-px">
              {[3, 2, 1].map((c) => (
                <Cell {...cellProps} key={c} betKey={`column:${c}`} className="h-10 bg-[#0b7a43] text-[9px] leading-tight">
                  2 a 1
                </Cell>
              ))}
            </div>
          </div>

          {/* Docenas */}
          <div className="flex gap-px">
            <div className="w-8 shrink-0" aria-hidden />
            <div className="grid flex-1 grid-cols-3 gap-px">
              <Cell {...cellProps} betKey="dozen:1" className="h-9 bg-[#0b7a43] text-[10px]">
                1-12
              </Cell>
              <Cell {...cellProps} betKey="dozen:2" className="h-9 bg-[#0b7a43] text-[10px]">
                13-24
              </Cell>
              <Cell {...cellProps} betKey="dozen:3" className="h-9 bg-[#0b7a43] text-[10px]">
                25-36
              </Cell>
            </div>
            <div className="w-11 shrink-0" aria-hidden />
          </div>

          {/* Apuestas exteriores simples */}
          <div className="flex gap-px">
            <div className="w-8 shrink-0" aria-hidden />
            <div className="grid flex-1 grid-cols-6 gap-px">
              <Cell {...cellProps} betKey="low" className="h-9 bg-[#0b7a43] text-[10px]">
                1-18
              </Cell>
              <Cell {...cellProps} betKey="even" className="h-9 bg-[#0b7a43] text-[10px]">
                PAR
              </Cell>
              <Cell {...cellProps} betKey="red" className="h-9 bg-[#c81e1e] text-base">
                ◆
              </Cell>
              <Cell {...cellProps} betKey="black" className="h-9 bg-[#1f2937] text-base">
                ◆
              </Cell>
              <Cell {...cellProps} betKey="odd" className="h-9 bg-[#0b7a43] text-[10px]">
                IMPAR
              </Cell>
              <Cell {...cellProps} betKey="high" className="h-9 bg-[#0b7a43] text-[10px]">
                19-36
              </Cell>
            </div>
            <div className="w-11 shrink-0" aria-hidden />
          </div>
        </div>
      </div>

      <p className="text-center text-[11px] text-slate-400">
        Toca un número (pleno) o los <span className="font-semibold">bordes y esquinas</span> para
        caballo, calle, cuadro y línea.
      </p>

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
        Pleno 35:1 · Caballo 17:1 · Calle 11:1 · Cuadro 8:1 · Línea 5:1 · Docena y columna 2:1 ·
        Color, par/impar y mitades 1:1
      </p>
    </div>
  )
}

type CellProps = {
  bets: Record<string, number>
  winningNumber: number | null
  spinning: boolean
  onPlace: (key: string) => void
}

function NumberCell({ n, ...rest }: { n: number } & CellProps) {
  return (
    <Cell {...rest} betKey={gkey([n])} className={`h-10 text-[11px] ${NUM_BG[colorOf(n)]}`}>
      {n}
    </Cell>
  )
}

function ChipBadge({ amount, win }: { amount: number; win: boolean }) {
  return (
    <span
      className={`flex h-5 w-5 items-center justify-center rounded-full border-2 bg-amber-400 text-[8px] font-bold leading-none text-slate-900 shadow-md ${
        win ? 'border-yellow-200 ring-2 ring-yellow-300' : 'border-white'
      }`}
    >
      {shortChip(amount)}
    </span>
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
}: { betKey: string; className?: string; children: React.ReactNode } & CellProps) {
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
        <span className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
          <ChipBadge amount={amount} win={win} />
        </span>
      )}
    </button>
  )
}

function Hotspot({ sp, bets, winningNumber, spinning, onPlace }: { sp: Spot } & CellProps) {
  const amount = bets[sp.key]
  const win = winningNumber != null && betWins(sp.key, winningNumber)
  return (
    <button
      type="button"
      disabled={spinning}
      onClick={() => onPlace(sp.key)}
      style={{ left: `${sp.x}%`, top: `${sp.y}%` }}
      className="pointer-events-auto absolute z-30 flex h-[22px] w-[22px] -translate-x-1/2 -translate-y-1/2 items-center justify-center disabled:cursor-default"
    >
      {amount != null ? (
        <ChipBadge amount={amount} win={win} />
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-white/25" />
      )}
    </button>
  )
}
