// Cálculos puros de la hoja de apuesta: cuota combinada y premio potencial.
// Se extraen aquí para poder testearlos sin montar React ni Supabase.

// Multiplica las cuotas de todas las patas (1 si no hay patas).
export function combinedOdds(legs: { price: number }[]): number {
  return legs.reduce((acc, l) => acc * l.price, 1)
}

// Premio potencial = stake × cuota combinada.
export function potentialPayout(stake: number, legs: { price: number }[]): number {
  return stake * combinedOdds(legs)
}
