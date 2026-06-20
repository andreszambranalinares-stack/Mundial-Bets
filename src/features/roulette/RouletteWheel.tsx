import { WHEEL_ORDER, colorOf } from '../../lib/roulette'

// Rueda europea presentacional: gira según `rotation` y la bola orbita según
// `ballRot` (en grados). La caída de la bola la controla la clase CSS
// `rw-ball-drop` (ver index.css), que se reinicia cambiando `spinKey`.

const CX = 150
const CY = 150
const RIM_OUT = 148
const RIM_IN = 132
const POCKET_OUT = 128
const POCKET_IN = 84
const HUB_OUT = 84
const STEP = 360 / WHEEL_ORDER.length // grados por casilla

const POCKET_FILL: Record<string, string> = {
  green: '#15803d',
  red: '#c81e1e',
  black: '#1f2937',
}

function pointFor(angleDeg: number, radius: number) {
  const t = ((angleDeg - 90) * Math.PI) / 180
  return { x: CX + radius * Math.cos(t), y: CY + radius * Math.sin(t) }
}

const ARCS = WHEEL_ORDER.map((num, i) => {
  const center = i * STEP
  const start = center - STEP / 2
  const end = center + STEP / 2
  const o1 = pointFor(start, POCKET_OUT)
  const o2 = pointFor(end, POCKET_OUT)
  const i2 = pointFor(end, POCKET_IN)
  const i1 = pointFor(start, POCKET_IN)
  const d =
    `M ${o1.x.toFixed(2)} ${o1.y.toFixed(2)} ` +
    `A ${POCKET_OUT} ${POCKET_OUT} 0 0 1 ${o2.x.toFixed(2)} ${o2.y.toFixed(2)} ` +
    `L ${i2.x.toFixed(2)} ${i2.y.toFixed(2)} ` +
    `A ${POCKET_IN} ${POCKET_IN} 0 0 0 ${i1.x.toFixed(2)} ${i1.y.toFixed(2)} Z`
  const label = pointFor(center, (POCKET_OUT + POCKET_IN) / 2)
  const fret = pointFor(start, POCKET_OUT)
  const fretIn = pointFor(start, POCKET_IN)
  return { num, center, d, label, fret, fretIn, color: colorOf(num) }
})

export default function RouletteWheel({
  rotation,
  ballRot,
  spinning,
  spinKey,
}: {
  rotation: number
  ballRot: number
  spinning: boolean
  spinKey: number
}) {
  return (
    <div
      className="relative mx-auto h-[300px] w-[300px] rounded-full"
      style={{
        background: 'radial-gradient(circle at 50% 35%, #1f2937 0%, #0b1220 70%)',
        boxShadow: '0 18px 40px rgba(0,0,0,0.55), inset 0 0 30px rgba(0,0,0,0.6), 0 0 0 6px #0b1220',
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

      <svg
        viewBox="0 0 300 300"
        className="h-full w-full"
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: spinning ? 'transform 5s cubic-bezier(0.12,0.62,0.07,1)' : 'none',
        }}
      >
        <defs>
          <radialGradient id="rouHub" cx="50%" cy="40%" r="65%">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="45%" stopColor="#cbd5e1" />
            <stop offset="100%" stopColor="#64748b" />
          </radialGradient>
          <linearGradient id="rouRim" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="35%" stopColor="#d4a017" />
            <stop offset="60%" stopColor="#a16207" />
            <stop offset="100%" stopColor="#facc15" />
          </linearGradient>
          <radialGradient id="rouShade" cx="50%" cy="50%" r="50%">
            <stop offset="70%" stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.4)" />
          </radialGradient>
        </defs>

        {/* Aro dorado */}
        <circle cx={CX} cy={CY} r={RIM_OUT} fill="url(#rouRim)" />
        <circle cx={CX} cy={CY} r={RIM_IN} fill="#0b1220" />

        {/* Casillas */}
        {ARCS.map((a, i) => (
          <path key={i} d={a.d} fill={POCKET_FILL[a.color]} stroke="#0b1220" strokeWidth={0.6} />
        ))}
        <circle cx={CX} cy={CY} r={POCKET_OUT} fill="url(#rouShade)" />

        {/* Separadores metálicos */}
        {ARCS.map((a, i) => (
          <line
            key={`f${i}`}
            x1={a.fret.x}
            y1={a.fret.y}
            x2={a.fretIn.x}
            y2={a.fretIn.y}
            stroke="#cbd5e1"
            strokeWidth={0.8}
            strokeLinecap="round"
            opacity={0.6}
          />
        ))}

        {/* Números */}
        {ARCS.map((a, i) => (
          <text
            key={`t${i}`}
            x={a.label.x}
            y={a.label.y}
            fill="#fff"
            fontSize={9}
            fontWeight={700}
            textAnchor="middle"
            dominantBaseline="middle"
            transform={`rotate(${a.center} ${a.label.x} ${a.label.y})`}
          >
            {a.num}
          </text>
        ))}

        {/* Turbina central */}
        <circle cx={CX} cy={CY} r={HUB_OUT} fill="#0b1220" />
        <circle cx={CX} cy={CY} r={HUB_OUT - 6} fill="url(#rouHub)" />
        {[0, 45, 90, 135].map((deg) => {
          const p1 = pointFor(deg, HUB_OUT - 8)
          const p2 = pointFor(deg + 180, HUB_OUT - 8)
          return (
            <line
              key={`s${deg}`}
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
        <circle cx={CX} cy={CY} r={22} fill="url(#rouRim)" stroke="#0b1220" strokeWidth={2} />
        <circle cx={CX} cy={CY} r={9} fill="#0b1220" />
      </svg>

      {/* Bola: orbita en su contenedor y cae con la animación rw-ball-drop */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          transform: `rotate(${ballRot}deg)`,
          transition: spinning ? 'transform 5s cubic-bezier(0.18,0.7,0.12,1)' : 'none',
        }}
      >
        <div
          key={spinKey}
          className={`absolute left-1/2 top-1/2 ${spinKey > 0 ? 'rw-ball-drop' : ''}`}
          style={{ transform: 'translate(-50%, -50%) translateY(-137px)' }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              background:
                'radial-gradient(circle at 32% 28%, #ffffff 0%, #e2e8f0 55%, #94a3b8 100%)',
              boxShadow: '0 2px 4px rgba(0,0,0,0.6)',
            }}
          />
        </div>
      </div>
    </div>
  )
}
