// Constantes y utilidades compartidas de la ruleta europea (un solo cero).
// Los pagos y la lógica de aciertos deben coincidir con la migración 0017.

// Orden físico de los números en la rueda europea (sentido horario desde el 0).
export const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24,
  16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
]

export const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36])

export type Color = 'green' | 'red' | 'black'

export function colorOf(n: number): Color {
  if (n === 0) return 'green'
  return RED.has(n) ? 'red' : 'black'
}

// Denominaciones de ficha disponibles en la mesa.
export const CHIP_VALUES = [10, 50, 100, 500, 1000]

export type ServerBet = { type: string; value?: number; nums?: number[]; amount: number }

// Una apuesta se identifica en el cliente por una clave:
//   "g:17" pleno · "g:1-2" caballo · "g:1-2-3" calle · "g:1-2-4-5" cuadro ·
//   "g:1-2-3-4-5-6" línea · "g:0-1-2-3" basket  (apuestas a números) ·
//   "dozen:1" docena · "column:3" columna ·
//   "red"|"black"|"even"|"odd"|"low"|"high" apuestas exteriores.
export function gkey(nums: number[]): string {
  return 'g:' + [...nums].sort((a, b) => a - b).join('-')
}

function keyNums(key: string): number[] {
  return key.slice(2).split('-').map(Number)
}

export function keyToServerBet(key: string, amount: number): ServerBet {
  if (key.startsWith('g:')) return { type: 'numbers', nums: keyNums(key), amount }
  if (key.startsWith('dozen:')) return { type: 'dozen', value: Number(key.slice(6)), amount }
  if (key.startsWith('column:')) return { type: 'column', value: Number(key.slice(7)), amount }
  return { type: key, amount }
}

// ¿Gana esta apuesta con el número que ha salido? (para resaltar el resultado)
export function betWins(key: string, n: number): boolean {
  if (key.startsWith('g:')) return keyNums(key).includes(n)
  if (key.startsWith('dozen:')) {
    const v = Number(key.slice(6))
    return n >= (v - 1) * 12 + 1 && n <= v * 12
  }
  if (key.startsWith('column:')) {
    const v = Number(key.slice(7))
    return n !== 0 && (v === 3 ? n % 3 === 0 : n % 3 === v)
  }
  switch (key) {
    case 'red':
      return RED.has(n)
    case 'black':
      return n !== 0 && !RED.has(n)
    case 'even':
      return n !== 0 && n % 2 === 0
    case 'odd':
      return n % 2 === 1
    case 'low':
      return n >= 1 && n <= 18
    case 'high':
      return n >= 19 && n <= 36
    default:
      return false
  }
}

// Etiqueta corta de un importe de ficha: 1000 -> "1k".
export const shortChip = (n: number) => (n >= 1000 ? `${n / 1000}k` : `${n}`)
