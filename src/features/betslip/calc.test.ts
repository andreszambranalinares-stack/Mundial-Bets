import { describe, it, expect } from 'vitest'
import { combinedOdds, potentialPayout } from './calc'

describe('combinedOdds', () => {
  it('es 1 sin patas', () => {
    expect(combinedOdds([])).toBe(1)
  })
  it('devuelve la cuota de una pata simple', () => {
    expect(combinedOdds([{ price: 2.5 }])).toBe(2.5)
  })
  it('multiplica las cuotas de una combinada', () => {
    expect(combinedOdds([{ price: 2 }, { price: 1.5 }, { price: 3 }])).toBe(9)
  })
})

describe('potentialPayout', () => {
  it('es stake × cuota combinada', () => {
    expect(potentialPayout(100, [{ price: 2 }, { price: 1.5 }])).toBe(300)
  })
  it('es el propio stake si no hay patas', () => {
    expect(potentialPayout(50, [])).toBe(50)
  })
})
