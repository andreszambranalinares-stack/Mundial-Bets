import { describe, it, expect } from 'vitest'
import { isLiveBet, passesFilter } from './filters'

// Constructor mínimo de boletos para los filtros (solo status + estados de patas).
function bet(status: string, legStatuses: (string | null)[] = []) {
  return { status, legs: legStatuses.map((s) => ({ match: s ? { status: s } : null })) }
}

describe('isLiveBet', () => {
  it('es true si está pendiente y alguna pata está en juego', () => {
    expect(isLiveBet(bet('pending', ['scheduled', 'live']))).toBe(true)
  })
  it('es false si no hay ninguna pata en juego', () => {
    expect(isLiveBet(bet('pending', ['scheduled', 'finished']))).toBe(false)
  })
  it('es false si el boleto ya no está pendiente aunque tenga patas en juego', () => {
    expect(isLiveBet(bet('won', ['live']))).toBe(false)
  })
})

describe('passesFilter', () => {
  const live = bet('pending', ['live'])
  const pending = bet('pending', ['scheduled'])
  const won = bet('won', ['finished'])

  it('"all" muestra todo lo no cerrado (pendiente y en directo, no ganadas)', () => {
    expect(passesFilter(pending, 'all')).toBe(true)
    expect(passesFilter(live, 'all')).toBe(true)
    expect(passesFilter(won, 'all')).toBe(false)
  })
  it('"pending" excluye las que están en directo', () => {
    expect(passesFilter(pending, 'pending')).toBe(true)
    expect(passesFilter(live, 'pending')).toBe(false)
  })
  it('"live" solo muestra las que están en directo', () => {
    expect(passesFilter(live, 'live')).toBe(true)
    expect(passesFilter(pending, 'live')).toBe(false)
  })
  it('"closed" muestra ganadas/perdidas/anuladas/retiradas', () => {
    expect(passesFilter(won, 'closed')).toBe(true)
    expect(passesFilter(bet('cashed_out'), 'closed')).toBe(true)
    expect(passesFilter(pending, 'closed')).toBe(false)
  })
})
