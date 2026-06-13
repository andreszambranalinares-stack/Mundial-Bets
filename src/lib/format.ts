// Utilidades de formato compartidas por la UI.

export function fmtChips(n: number): string {
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(Math.round(n))
}

export function fmtOdds(n: number): string {
  return n.toFixed(2)
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Hora corta (para mensajes de chat): 14:05
export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

// Tiempo relativo aproximado: "ahora", "hace 5 min", "hace 2 h", "hace 3 d"
export function fmtTimeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'ahora'
  const m = Math.floor(s / 60)
  if (m < 60) return `hace ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.floor(h / 24)
  return `hace ${d} d`
}

export const SELECTION_LABEL: Record<string, string> = {
  home: '1',
  draw: 'X',
  away: '2',
  over: 'Más de',
  under: 'Menos de',
}

// Texto legible de una selección (1X2 u over/under) con los nombres de equipo.
export function selectionText(
  market: string,
  selection: string,
  point: number,
  home: string,
  away: string,
): string {
  if (market === 'h2h') {
    if (selection === 'home') return home
    if (selection === 'away') return away
    return 'Empate'
  }
  return selection === 'over' ? `Más de ${point} goles` : `Menos de ${point} goles`
}

// Texto de una pata/selección que admite mercados avanzados (con label y jugador).
export function legText(
  leg: { market: string; selection: string; point: number; label?: string | null; playerName?: string | null },
  home: string,
  away: string,
): string {
  if (leg.label) {
    const base = leg.label.replace('Local', home).replace('Visitante', away)
    return leg.playerName ? `${leg.playerName} ${base}` : base
  }
  return selectionText(leg.market, leg.selection, leg.point, home, away)
}
