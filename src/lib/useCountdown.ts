import { useEffect, useState } from 'react'

export interface Remaining {
  total: number // ms restantes (<=0 si ya empezó)
  days: number
  hours: number
  minutes: number
  seconds: number
}

function diff(targetMs: number): Remaining {
  const total = Math.max(0, targetMs - Date.now())
  const s = Math.floor(total / 1000)
  return {
    total,
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  }
}

// Cuenta atrás que se actualiza cada segundo hasta `targetIso`.
export function useCountdown(targetIso: string): Remaining {
  const targetMs = new Date(targetIso).getTime()
  const [rem, setRem] = useState<Remaining>(() => diff(targetMs))

  useEffect(() => {
    setRem(diff(targetMs))
    if (Date.now() >= targetMs) return
    const id = setInterval(() => {
      const next = diff(targetMs)
      setRem(next)
      if (next.total <= 0) clearInterval(id)
    }, 1000)
    return () => clearInterval(id)
  }, [targetMs])

  return rem
}
