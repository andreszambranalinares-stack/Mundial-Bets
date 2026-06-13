// Utilidades para Football-Data.org (marcador en directo del Mundial).
// La API key vive solo aquí (secret FOOTBALL_DATA_API_KEY), nunca en el frontend.
const FD_BASE = 'https://api.football-data.org/v4'

function fdKey(): string {
  const key = Deno.env.get('FOOTBALL_DATA_API_KEY')
  if (!key) throw new Error('Falta el secret FOOTBALL_DATA_API_KEY')
  return key
}

export interface FdMatch {
  id: number
  utcDate: string
  status: 'SCHEDULED' | 'TIMED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED' | 'SUSPENDED' | 'POSTPONED' | 'CANCELLED'
  minute?: string | number | null
  score: {
    duration?: 'REGULAR' | 'EXTRA_TIME' | 'PENALTY_SHOOTOUT'
    fullTime: { home: number | null; away: number | null }
    halfTime?: { home: number | null; away: number | null }
  }
  homeTeam: { name: string; shortName?: string; tla?: string }
  awayTeam: { name: string; shortName?: string; tla?: string }
}

// Partidos del Mundial (competición WC) en una ventana de ±1 día.
export async function fetchWorldCupMatches(): Promise<FdMatch[]> {
  const day = 86400000
  const from = new Date(Date.now() - day).toISOString().slice(0, 10)
  const to = new Date(Date.now() + day).toISOString().slice(0, 10)
  const url = `${FD_BASE}/competitions/WC/matches?dateFrom=${from}&dateTo=${to}`
  const res = await fetch(url, { headers: { 'X-Auth-Token': fdKey() } })
  if (!res.ok) throw new Error(`Football-Data ${res.status}: ${await res.text()}`)
  const json = await res.json()
  return (json.matches ?? []) as FdMatch[]
}

// Normaliza un nombre de equipo para emparejar entre proveedores:
// minúsculas, sin acentos, y con alias para las diferencias más comunes.
const ALIASES: Record<string, string> = {
  'korea republic': 'south korea',
  'korea dpr': 'north korea',
  'ir iran': 'iran',
  'china pr': 'china',
  usa: 'united states',
  'united states of america': 'united states',
  'cote divoire': 'ivory coast',
  czechia: 'czech republic',
  turkiye: 'turkey',
}

export function normalizeTeam(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z ]/g, '')
    .trim()
  return ALIASES[base] ?? base
}

export function fdPeriod(m: FdMatch): string | null {
  if (m.status === 'PAUSED') return 'half_time'
  const d = m.score?.duration
  if (d === 'EXTRA_TIME') return 'extra_time'
  if (d === 'PENALTY_SHOOTOUT') return 'penalties'
  return 'regular'
}
