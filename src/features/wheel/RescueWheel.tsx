import { useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fmtChips } from '../../lib/format'
import { captureError } from '../../lib/monitoring'

type Segment = { prize: number; weight: number; color: string }

// IMPORTANTE: premios y pesos deben coincidir con la migración 0016
// (spin_rescue_wheel). Aquí solo se usan para dibujar y aterrizar la rueda.
const SEGMENTS: Segment[] = [
  { prize: 10, weight: 35, color: '#16a34a' },
  { prize: 50, weight: 27, color: '#0284c7' },
  { prize: 100, weight: 20, color: '#9333ea' },
  { prize: 500, weight: 11, color: '#d97706' },
  { prize: 1000, weight: 5, color: '#db2777' },
  { prize: 5000, weight: 2, color: '#dc2626' },
]
const TOTAL = SEGMENTS.reduce((s, x) => s + x.weight, 0)

const CX = 150
const CY = 150
// Geometría de los anillos de la ruleta (en el viewBox 0 0 300 300).
const RIM_OUT = 148 // borde dorado exterior
const RIM_IN = 130
const POCKET_OUT = 126 // casillas de premio (donde cae la bola)
const POCKET_IN = 80
const HUB_OUT = 80 // turbina central

// Radios de la bola (en píxeles, sobre un contenedor de 300x300).
const BALL_TRACK = 137 // orbita en el aro antes de caer
const BALL_REST = 103 // reposa dentro de la casilla ganadora

function pointFor(angleDeg: number, radius: number) {
  const t = ((angleDeg - 90) * Math.PI) / 180
  return { x: CX + radius * Math.cos(t), y: CY + radius * Math.sin(t) }
}

const shortPrize = (p: number) => (p >= 1000 ? `${p / 1000}k` : `${p}`)

// Sectores de anillo pre-calculados (sentido horario desde arriba).
const ARCS = (() => {
  let acc = 0
  return SEGMENTS.map((seg) => {
    const start = (acc / TOTAL) * 360
    acc += seg.weight
    const end = (acc / TOTAL) * 360
    const center = (start + end) / 2
    const large = end - start > 180 ? 1 : 0

    const o1 = pointFor(start, POCKET_OUT)
    const o2 = pointFor(end, POCKET_OUT)
    const i2 = pointFor(end, POCKET_IN)
    const i1 = pointFor(start, POCKET_IN)
    const d =
      `M ${o1.x.toFixed(2)} ${o1.y.toFixed(2)} ` +
      `A ${POCKET_OUT} ${POCKET_OUT} 0 ${large} 1 ${o2.x.toFixed(2)} ${o2.y.toFixed(2)} ` +
      `L ${i2.x.toFixed(2)} ${i2.y.toFixed(2)} ` +
      `A ${POCKET_IN} ${POCKET_IN} 0 ${large} 0 ${i1.x.toFixed(2)} ${i1.y.toFixed(2)} Z`

    const label = pointFor(center, (POCKET_OUT + POCKET_IN) / 2)
    const fret = pointFor(start, POCKET_OUT)
    const fretIn = pointFor(start, POCKET_IN)
    return { ...seg, center, d, label, fret, fretIn }
  })
})()

type Phase = 'idle' | 'spinning' | 'done'

export default function RescueWheel({ leagueId, onDone }: { leagueId: string; onDone: () => void }) {
  const [rotation, setRotation] = useState(0)
  const [ballRot, setBallRot] = useState(0)
  const [phase, setPhase] = useState<Phase>('idle')
  const [prize, setPrize] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const rotRef = useRef(0)

  const spinning = phase === 'spinning'

  async function spin() {
    if (spinning || prize != null) return
    setPhase('spinning')
    setError(null)
    const { data, error } = await supabase.rpc('spin_rescue_wheel', { p_league_id: leagueId })
    if (error || data == null) {
      setPhase('idle')
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
    // La bola orbita en sentido contrario y termina arriba, sobre el ganador.
    setBallRot(-360 * 8)

    window.setTimeout(() => {
      setPrize(won)
      setPhase('done')
    }, 5000)
  }

  const ballRadius = phase === 'idle' ? BALL_TRACK : BALL_REST

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-5 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">¡Te quedaste sin fichas!</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Gira la ruleta de rescate y llévate fichas para seguir jugando.
        </p>

        <div
          className="relative mx-auto mt-6 h-[300px] w-[300px] rounded-full"
          style={{
            background: 'radial-gradient(circle at 50% 35%, #1f2937 0%, #0b1220 70%)',
            boxShadow:
              '0 18px 40px rgba(0,0,0,0.55), inset 0 0 30px rgba(0,0,0,0.6), 0 0 0 6px #0b1220',
          }}
        >
          {/* Flecha indicadora arriba */}
          <div
            className="absolute left-1/2 top-[-10px] z-30 -translate-x-1/2"
            style={{
              width: 0,
              height: 0,
              borderLeft: '11px solid transparent',
              borderRight: '11px solid transparent',
              borderTop: '20px solid #f1f5f9',
              filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.5))',
            }}
          />

          {/* Rueda giratoria */}
          <svg
            viewBox="0 0 300 300"
            className="h-full w-full"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? 'transform 5s cubic-bezier(0.12,0.62,0.07,1)' : 'none',
            }}
          >
            <defs>
              <radialGradient id="rwHub" cx="50%" cy="40%" r="65%">
                <stop offset="0%" stopColor="#f8fafc" />
                <stop offset="45%" stopColor="#cbd5e1" />
                <stop offset="100%" stopColor="#64748b" />
              </radialGradient>
              <linearGradient id="rwRim" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fde68a" />
                <stop offset="35%" stopColor="#d4a017" />
                <stop offset="60%" stopColor="#a16207" />
                <stop offset="100%" stopColor="#facc15" />
              </linearGradient>
              <radialGradient id="rwPocketShade" cx="50%" cy="50%" r="50%">
                <stop offset="70%" stopColor="rgba(0,0,0,0)" />
                <stop offset="100%" stopColor="rgba(0,0,0,0.35)" />
              </radialGradient>
            </defs>

            {/* Aro dorado exterior */}
            <circle cx={CX} cy={CY} r={RIM_OUT} fill="url(#rwRim)" />
            <circle cx={CX} cy={CY} r={RIM_IN} fill="#0b1220" />

            {/* Casillas de premio */}
            {ARCS.map((a) => (
              <path key={`p-${a.prize}`} d={a.d} fill={a.color} stroke="#0b1220" strokeWidth={1} />
            ))}
            {/* Sombreado para dar profundidad a las casillas */}
            <circle cx={CX} cy={CY} r={POCKET_OUT} fill="url(#rwPocketShade)" />

            {/* Separadores metálicos (frets) entre casillas */}
            {ARCS.map((a) => (
              <line
                key={`f-${a.prize}`}
                x1={a.fret.x}
                y1={a.fret.y}
                x2={a.fretIn.x}
                y2={a.fretIn.y}
                stroke="#e2e8f0"
                strokeWidth={1.4}
                strokeLinecap="round"
                opacity={0.7}
              />
            ))}

            {/* Etiquetas de premio */}
            {ARCS.map((a) => (
              <text
                key={`t-${a.prize}`}
                x={a.label.x}
                y={a.label.y}
                fill="#fff"
                fontSize={a.weight < 8 ? 12 : 16}
                fontWeight={800}
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(${a.center} ${a.label.x} ${a.label.y})`}
                style={{ paintOrder: 'stroke', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}
              >
                {shortPrize(a.prize)}
              </text>
            ))}

            {/* Turbina central */}
            <circle cx={CX} cy={CY} r={HUB_OUT} fill="#0b1220" />
            <circle cx={CX} cy={CY} r={HUB_OUT - 6} fill="url(#rwHub)" />
            {[0, 45, 90, 135].map((deg) => {
              const p1 = pointFor(deg, HUB_OUT - 8)
              const p2 = pointFor(deg + 180, HUB_OUT - 8)
              return (
                <line
                  key={`s-${deg}`}
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke="#94a3b8"
                  strokeWidth={3}
                  strokeLinecap="round"
                />
              )
            })}
            <circle cx={CX} cy={CY} r={22} fill="url(#rwRim)" stroke="#0b1220" strokeWidth={2} />
            <circle cx={CX} cy={CY} r={9} fill="#0b1220" />
          </svg>

          {/* Bola: orbita en su propio contenedor y cae en la casilla */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              transform: `rotate(${ballRot}deg)`,
              transition: spinning ? 'transform 5s cubic-bezier(0.18,0.7,0.12,1)' : 'none',
            }}
          >
            <div
              className="absolute left-1/2 top-1/2"
              style={{
                transform: `translate(-50%, -50%) translateY(-${ballRadius}px)`,
                transition: spinning
                  ? 'transform 1.6s cubic-bezier(0.5,-0.25,0.3,1.3) 2.9s'
                  : 'none',
              }}
            >
              <div
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle at 32% 28%, #ffffff 0%, #e2e8f0 55%, #94a3b8 100%)',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.6)',
                }}
              />
            </div>
          </div>
        </div>

        {prize == null ? (
          <>
            {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
            <button className="btn-primary mt-6 w-full" disabled={spinning} onClick={spin}>
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
            <div className="mt-6 rounded-2xl bg-brand/15 px-4 py-3">
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
