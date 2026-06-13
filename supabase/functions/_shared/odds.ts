// Utilidades compartidas por las edge functions: cliente admin de Supabase
// y llamadas a The Odds API. La API key vive solo aquí (servidor), nunca en el frontend.
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const SPORT_KEY = 'soccer_fifa_world_cup'
const ODDS_BASE = 'https://api.the-odds-api.com/v4'

export function adminClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')!
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  return createClient(url, serviceRole, { auth: { persistSession: false } })
}

function apiKey(): string {
  const key = Deno.env.get('ODDS_API_KEY')
  if (!key) throw new Error('Falta el secret ODDS_API_KEY')
  return key
}

export interface OddsEvent {
  id: string
  sport_key: string
  commence_time: string
  home_team: string
  away_team: string
  bookmakers: {
    key: string
    title: string
    markets: { key: string; outcomes: { name: string; price: number; point?: number }[] }[]
  }[]
}

export interface ScoreEvent {
  id: string
  completed: boolean
  home_team: string
  away_team: string
  scores: { name: string; score: string }[] | null
}

export async function fetchOdds(): Promise<OddsEvent[]> {
  const url = `${ODDS_BASE}/sports/${SPORT_KEY}/odds/?apiKey=${apiKey()}&regions=eu&markets=h2h,totals&oddsFormat=decimal`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Odds API ${res.status}: ${await res.text()}`)
  return res.json()
}

export async function fetchScores(daysFrom = 3): Promise<ScoreEvent[]> {
  const url = `${ODDS_BASE}/sports/${SPORT_KEY}/scores/?apiKey=${apiKey()}&daysFrom=${daysFrom}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Scores API ${res.status}: ${await res.text()}`)
  return res.json()
}

// Convierte un evento de la API en filas de match_odds (toma el primer bookmaker
// que ofrezca cada mercado). selection se normaliza a home/draw/away/over/under.
export function extractOdds(ev: OddsEvent) {
  const rows: { market: string; selection: string; point: number; price: number }[] = []

  const h2h = ev.bookmakers.find((b) => b.markets.some((m) => m.key === 'h2h'))
    ?.markets.find((m) => m.key === 'h2h')
  if (h2h) {
    for (const o of h2h.outcomes) {
      let selection: string | null = null
      if (o.name === ev.home_team) selection = 'home'
      else if (o.name === ev.away_team) selection = 'away'
      else if (o.name === 'Draw') selection = 'draw'
      if (selection) rows.push({ market: 'h2h', selection, point: 0, price: o.price })
    }
  }

  const totals = ev.bookmakers.find((b) => b.markets.some((m) => m.key === 'totals'))
    ?.markets.find((m) => m.key === 'totals')
  if (totals) {
    for (const o of totals.outcomes) {
      const selection = o.name.toLowerCase() === 'over' ? 'over'
        : o.name.toLowerCase() === 'under' ? 'under' : null
      if (selection && o.point != null) {
        rows.push({ market: 'totals', selection, point: o.point, price: o.price })
      }
    }
  }

  return rows
}
