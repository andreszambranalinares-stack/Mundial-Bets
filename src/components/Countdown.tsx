import { useCountdown } from '../lib/useCountdown'

const HOUR_MS = 60 * 60 * 1000

// Cuenta atrás para el inicio de un partido. Cuando empieza, muestra "En juego".
// Si falta menos de una hora, se resalta para llamar la atención.
export default function Countdown({ target }: { target: string }) {
  const r = useCountdown(target)

  if (r.total <= 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-400">
        <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
        En juego
      </span>
    )
  }

  const soon = r.total < HOUR_MS
  const pad = (n: number) => n.toString().padStart(2, '0')

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${
        soon ? 'animate-pulse bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-300'
      }`}
    >
      ⏱{' '}
      {r.days > 0 && <span>{r.days}d</span>}
      {pad(r.hours)}:{pad(r.minutes)}:{pad(r.seconds)}
    </span>
  )
}
