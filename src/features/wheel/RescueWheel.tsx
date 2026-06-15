import { useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fmtChips } from '../../lib/format'
import { captureError } from '../../lib/monitoring'

type Segment = { prize: number; weight: number; color: string }

// IMPORTANTE: premios y pesos deben coincidir con la migración 0016
// (spin_rescue_wheel). Aquí solo se usan para dibujar y aterrizar la rueda.
const SEGMENTS: Segment[] = [
  { prize: 10, weight: 35, color: '#22c55e' },
  { prize: 50, weight: 27, color: '#0ea5e9' },
  { prize: 100, weight: 20, color: '#a855f7' },
  { prize: 500, weight: 11, color: '#f59e0b' },
  { prize: 1000, weight: 5, color: '#ec4899' },
  { prize: 5000, weight: 2, color: '#ef4444' },
]
const TOTAL = SEGMENTS.reduce((s, x) => s + x.weight, 0)
const CX = 150
const CY = 150
const R = 138

function pointFor(angleDeg: number, radius: number) {
  const t = ((angleDeg - 90) * Math.PI) / 180
  return { x: CX + radius * Math.cos(t), y: CY + radius * Math.sin(t) }
}

const shortPrize = (p: number) => (p >= 1000 ? `${p / 1000}k` : `${p}`)

// Arcos pre-calculados (en sentido horario desde arriba).
const ARCS = (() => {
  let acc = 0
  return SEGMENTS.map((seg) => {
    const start = (acc / TOTAL) * 360
    acc += seg.weight
    const end = (acc / TOTAL) * 360
    const center = (start + end) / 2
    const p1 = pointFor(start, R)
    const p2 = pointFor(end, R)
    const large = end - start > 180 ? 1 : 0
    const d = `M ${CX} ${CY} L ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} Z`
    const label = pointFor(center, seg.weight < 8 ? R * 0.82 : R * 0.64)
    return { ...seg, center, d, label }
  })
})()

export default function RescueWheel({ leagueId, onDone }: { leagueId: string; onDone: () => void }) {
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [prize, setPrize] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const rotRef = useRef(0)

  async function spin() {
    if (spinning || prize != null) return
    setSpinning(true)
    setError(null)
    const { data, error } = await supabase.rpc('spin_rescue_wheel', { p_league_id: leagueId })
    if (error || data == null) {
      setSpinning(false)
      captureError(error ?? new Error('spin devolvió null'), 'spin_rescue_wheel')
      setError(error?.message ?? 'No se pudo girar la ruleta')
      return
    }
    const won = Number(data)
    const arc = ARCS.find((a) => a.prize === won) ?? ARCS[0]
    // Llevar el centro del gajo ganador arriba (bajo la flecha) + varias vueltas.
    const desired = (360 - (arc.center % 360) + 360) % 360
    const next = Math.ceil((rotRef.current + 360 * 5) / 360) * 360 + desired
    rotRef.current = next
    setRotation(next)
    window.setTimeout(() => {
      setPrize(won)
      setSpinning(false)
    }, 4200)
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-5">
      <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">¡Te quedaste sin fichas!</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Gira la ruleta de rescate y llévate fichas para seguir jugando.
        </p>

        <div className="relative mx-auto mt-5 h-[300px] w-[300px]">
          {/* Flecha roja arriba */}
          <div
            className="absolute left-1/2 top-[-4px] z-10 -translate-x-1/2"
            style={{
              width: 0,
              height: 0,
              borderLeft: '12px solid transparent',
              borderRight: '12px solid transparent',
              borderTop: '22px solid #ef4444',
              filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.4))',
            }}
          />
          <svg
            viewBox="0 0 300 300"
            className="h-full w-full"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? 'transform 4s cubic-bezier(0.15,0.7,0.1,1)' : 'none',
            }}
          >
            <circle cx={CX} cy={CY} r={R + 6} fill="#0f172a" />
            {ARCS.map((a) => (
              <g key={a.prize}>
                <path d={a.d} fill={a.color} stroke="#0f172a" strokeWidth={1.5} />
                <text
                  x={a.label.x}
                  y={a.label.y}
                  fill="#fff"
                  fontSize={a.weight < 8 ? 11 : 15}
                  fontWeight={800}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${a.center} ${a.label.x} ${a.label.y})`}
                >
                  {shortPrize(a.prize)}
                </text>
              </g>
            ))}
            <circle cx={CX} cy={CY} r={16} fill="#fff" stroke="#0f172a" strokeWidth={3} />
          </svg>
        </div>

        {prize == null ? (
          <>
            {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
            <button className="btn-primary mt-5 w-full" disabled={spinning} onClick={spin}>
              {spinning ? 'Girando...' : '🎡 Girar la ruleta'}
            </button>
            {!spinning && (
              <button onClick={onDone} className="mt-2 text-xs text-slate-400 hover:text-slate-500">
                Ahora no
              </button>
            )}
          </>
        ) : (
          <>
            <div className="mt-5 rounded-2xl bg-brand/15 px-4 py-3">
              <div className="text-3xl">🎉</div>
              <p className="mt-1 font-bold text-slate-900 dark:text-white">
                ¡Ganaste {fmtChips(prize)} fichas!
              </p>
            </div>
            <button className="btn-primary mt-4 w-full" onClick={onDone}>
              Seguir jugando
            </button>
          </>
        )}
      </div>
    </div>
  )
}
