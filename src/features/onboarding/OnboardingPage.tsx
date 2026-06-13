import { useState } from 'react'
import Logo from '../../components/Logo'

interface Slide {
  icon: string
  title: string
  desc: string
}

const SLIDES: Slide[] = [
  {
    icon: '👋',
    title: '¡Bienvenido a Fantasy Bet!',
    desc: 'Apuestas ficticias del Mundial 2026 para picarte con tus amigos. Sin dinero real: solo fichas y honor.',
  },
  {
    icon: '🤝',
    title: 'Únete a una liga',
    desc: 'Crea tu propia liga o entra en la de tus amigos con un código de invitación. Cada liga tiene su economía de fichas.',
  },
  {
    icon: '🎫',
    title: 'Haz tu apuesta',
    desc: 'Toca las cuotas de los partidos para añadirlas a tu boleto. Combina varias para multiplicar la cuota.',
  },
  {
    icon: '🪙',
    title: 'Gana fichas',
    desc: 'Empiezas con 1000 fichas. Si aciertas, cobras según la cuota; si fallas, pierdes lo apostado. Puedes retirar antes de que empiece el partido.',
  },
  {
    icon: '🏆',
    title: 'Sube en el ranking',
    desc: 'Compite por la cima de la clasificación de tu liga y presume de tus aciertos. ¡Que gane el mejor!',
  },
]

export default function OnboardingPage({ onFinish }: { onFinish: () => void }) {
  const [i, setI] = useState(0)
  const last = i === SLIDES.length - 1
  const s = SLIDES[i]

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col px-6 py-8">
      <div className="flex items-center justify-between">
        <Logo size={36} />
        <button onClick={onFinish} className="text-sm text-slate-500 dark:text-slate-400">
          Saltar
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="text-7xl">{s.icon}</div>
        <h2 className="mt-6 text-2xl font-bold text-slate-900 dark:text-white">{s.title}</h2>
        <p className="mt-3 max-w-xs text-slate-600 dark:text-slate-300">{s.desc}</p>
      </div>

      {/* Puntos */}
      <div className="mb-6 flex justify-center gap-2">
        {SLIDES.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setI(idx)}
            aria-label={`Ir a la pantalla ${idx + 1}`}
            className={`h-2 rounded-full transition-all ${
              idx === i ? 'w-6 bg-brand' : 'w-2 bg-slate-300 dark:bg-slate-700'
            }`}
          />
        ))}
      </div>

      <div className="flex gap-3">
        {i > 0 && (
          <button className="btn-ghost flex-1" onClick={() => setI((v) => v - 1)}>
            Atrás
          </button>
        )}
        <button
          className="btn-primary flex-1"
          onClick={() => (last ? onFinish() : setI((v) => v + 1))}
        >
          {last ? 'Empezar' : 'Siguiente'}
        </button>
      </div>
    </div>
  )
}
