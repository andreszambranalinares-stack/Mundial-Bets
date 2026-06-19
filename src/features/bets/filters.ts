// Lógica de filtrado de "Mis apuestas". Extraída del componente para poder testearla.
import type { Bet, BetLeg, Match } from '../../lib/database.types'

export type LegRow = BetLeg & { match?: Match }
export type BetRow = Bet & { legs: LegRow[] }
export type Filter = 'all' | 'pending' | 'won' | 'closed'

// Estados de boleto que se consideran "cerrados" (ya no pendientes).
export const CLOSED = new Set(['won', 'lost', 'void', 'cashed_out'])

// Tipo mínimo que necesitan los filtros (un BetRow lo cumple estructuralmente).
type FilterableBet = { status: string; legs: { match?: { status?: string | null } | null }[] }

// Un boleto está "en directo" si sigue pendiente y alguna de sus patas
// corresponde a un partido en juego.
export function isLiveBet(bet: FilterableBet): boolean {
  return bet.status === 'pending' && bet.legs.some((l) => l.match?.status === 'live')
}

export function passesFilter(bet: FilterableBet, f: Filter): boolean {
  if (f === 'all') return !CLOSED.has(bet.status)
  if (f === 'won') return bet.status === 'won'
  if (f === 'pending') return bet.status === 'pending' && !isLiveBet(bet)
  return CLOSED.has(bet.status)
}
