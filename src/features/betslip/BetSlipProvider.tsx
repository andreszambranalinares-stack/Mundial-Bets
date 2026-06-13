import { createContext, useContext, useState, type ReactNode } from 'react'
import type { SlipLeg } from '../../lib/database.types'

interface BetSlipValue {
  legs: SlipLeg[]
  toggle: (leg: SlipLeg) => void
  remove: (matchId: string) => void
  clear: () => void
  isSelected: (matchId: string, market: string, selection: string, point: number, playerName?: string) => boolean
}

const BetSlipContext = createContext<BetSlipValue | null>(null)

export function useBetSlip(): BetSlipValue {
  const ctx = useContext(BetSlipContext)
  if (!ctx) throw new Error('useBetSlip fuera de BetSlipProvider')
  return ctx
}

export function BetSlipProvider({ children }: { children: ReactNode }) {
  const [legs, setLegs] = useState<SlipLeg[]>([])

  function toggle(p: SlipLeg) {
    setLegs((prev) => {
      const isExact = (l: SlipLeg) =>
        l.match.id === p.match.id &&
        l.market === p.market &&
        l.selection === p.selection &&
        l.point === p.point &&
        (l.playerName ?? '') === (p.playerName ?? '')
      if (prev.some(isExact)) return prev.filter((l) => !isExact(l))
      return [...prev, p]
    })
  }

  function remove(matchId: string) {
    setLegs((prev) => prev.filter((l) => l.match.id !== matchId))
  }

  function clear() {
    setLegs([])
  }

  function isSelected(matchId: string, market: string, selection: string, point: number, playerName?: string) {
    return legs.some(
      (l) =>
        l.match.id === matchId &&
        l.market === market &&
        l.selection === selection &&
        l.point === point &&
        (playerName === undefined ? true : (l.playerName ?? '') === (playerName ?? '')),
    )
  }

  return (
    <BetSlipContext.Provider value={{ legs, toggle, remove, clear, isSelected }}>
      {children}
    </BetSlipContext.Provider>
  )
}
