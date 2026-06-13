// Edge function: COTIZA y APLICA la retirada (cash-out) de una apuesta.
//
//  - POST { bet_id, confirm? }  con  Authorization: Bearer <jwt del usuario>
//  - Si confirm=false (o ausente): devuelve { value } (cotización, no toca nada).
//  - Si confirm=true: aplica la retirada (apply_cashout) y devuelve { value, balance }.
//
// Reglas de valoración:
//  - Si NINGUNA pata ha empezado  -> devolución íntegra del stake (sin comisión).
//  - Si alguna pata está en juego  -> se consulta el marcador en vivo (con caché
//    de unos minutos para no gastar créditos) y se calcula:
//        valor = stake * cuotas_ganadas(tope 3) * Π(patas pendientes: cuota * prob) * margen
//  - Si alguna pata ya está perdida -> no se puede retirar.
import { adminClient, fetchScores } from '../_shared/odds.ts'

const MARGIN = 0.92            // comisión de la "casa" en retiradas en vivo
const SCORE_TTL_MS = 3 * 60_000 // caché del marcador en vivo
const MATCH_MINUTES = 95        // duración estimada (con descuento) para el % de tiempo

type Leg = {
  id: number
  match_id: string
  market: 'h2h' | 'totals'
  selection: 'home' | 'draw' | 'away' | 'over' | 'under'
  point: number
  odds_taken: number
  status: 'pending' | 'won' | 'lost' | 'void'
}
type MatchRow = {
  id: string
  home_team: string
  away_team: string
  commence_time: string
  status: string
  home_score: number | null
  away_score: number | null
  scores_updated_at: string | null
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  })

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const clamp = (p: number) => Math.min(0.99, Math.max(0.01, p))
const round2 = (n: number) => Math.round(n * 100) / 100

// Probabilidad actual de que una pata acabe ganando, según marcador + minuto.
// Mezcla la cuota original (inicio) con el "resultado actual" (final), ponderada
// por el tiempo transcurrido: al principio pesa la cuota, al final el marcador.
function legWinProb(leg: Leg, m: MatchRow, now: number): number {
  const odds = Number(leg.odds_taken)
  const p0 = 1 / odds
  const elapsed = Math.max(0, (now - new Date(m.commence_time).getTime()) / 60_000)
  const t = Math.min(1, elapsed / MATCH_MINUTES)
  const hs = m.home_score ?? 0
  const as = m.away_score ?? 0

  let pTarget: number
  if (leg.market === 'h2h') {
    if (leg.selection === 'draw') {
      const diff = Math.abs(hs - as)
      pTarget = diff === 0 ? 0.7 : diff === 1 ? 0.14 : 0.02
    } else {
      const lead = leg.selection === 'home' ? hs - as : as - hs
      pTarget = lead >= 2 ? 0.97 : lead === 1 ? 0.86 : lead === 0 ? 0.22 : lead === -1 ? 0.06 : 0.02
    }
  } else {
    const total = hs + as
    const point = Number(leg.point)
    if (leg.selection === 'over') {
      pTarget = total > point ? 0.99 : 0.45 - Math.min(0.4, t * 0.4)
    } else {
      pTarget = total >= point ? 0.01 : 0.55 + Math.min(0.44, t * 0.44)
    }
  }
  return clamp(p0 + (pTarget - p0) * t)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const db = adminClient()

    // Identidad del que llama (su JWT)
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const { data: userData } = await db.auth.getUser(jwt)
    const uid = userData?.user?.id
    if (!uid) return json(401, { error: 'No autenticado' })

    const { bet_id, confirm } = await req.json()
    if (!bet_id) return json(400, { error: 'Falta bet_id' })

    const { data: bet } = await db.from('bets').select('*').eq('id', bet_id).maybeSingle()
    if (!bet || bet.user_id !== uid) return json(404, { error: 'Apuesta no encontrada' })
    if (bet.status !== 'pending') return json(400, { error: 'La apuesta ya no está activa' })

    const { data: legsData } = await db.from('bet_legs').select('*').eq('bet_id', bet_id)
    const legs = (legsData ?? []) as Leg[]
    if (legs.some((l) => l.status === 'lost'))
      return json(400, { error: 'No se puede retirar: la combinada ya tiene una pata perdida' })

    const ids = [...new Set(legs.map((l) => l.match_id))]
    let { data: matchesData } = await db.from('matches').select('*').in('id', ids)
    let byId = new Map((matchesData ?? []).map((m) => [m.id, m as MatchRow]))

    const now = Date.now()
    const started = (l: Leg) => new Date(byId.get(l.match_id)!.commence_time).getTime() <= now
    const pending = legs.filter((l) => l.status === 'pending')
    const liveLegs = pending.filter(started)

    // Caso fácil: nada ha empezado -> devolución íntegra
    if (liveLegs.length === 0 && legs.every((l) => l.status === 'pending')) {
      const value = round2(Number(bet.stake))
      if (confirm) {
        const balance = await apply(db, bet_id, value)
        return json(200, { value, balance, full_refund: true })
      }
      return json(200, { value, full_refund: true })
    }

    // Refrescar marcador en vivo si está obsoleto (una sola llamada trae todos)
    const stale = liveLegs.some((l) => {
      const m = byId.get(l.match_id)!
      return !m.scores_updated_at || now - new Date(m.scores_updated_at).getTime() > SCORE_TTL_MS
    })
    if (stale) {
      const events = await fetchScores(2)
      const stamp = new Date().toISOString()
      for (const ev of events) {
        if (!ids.includes(ev.id)) continue
        const h = ev.scores?.find((s) => s.name === ev.home_team)
        const a = ev.scores?.find((s) => s.name === ev.away_team)
        await db
          .from('matches')
          .update({
            home_score: h ? parseInt(h.score, 10) : null,
            away_score: a ? parseInt(a.score, 10) : null,
            status: ev.completed ? 'finished' : 'live',
            scores_updated_at: stamp,
          })
          .eq('id', ev.id)
      }
      ;({ data: matchesData } = await db.from('matches').select('*').in('id', ids))
      byId = new Map((matchesData ?? []).map((m) => [m.id, m as MatchRow]))
    }

    // Cuotas ya ganadas (tope de 3, las de cuota más baja: conservador, no infla)
    const wonOdds = legs
      .filter((l) => l.status === 'won')
      .map((l) => Number(l.odds_taken))
      .sort((x, y) => x - y)
      .slice(0, 3)
    const lockedMult = wonOdds.reduce((acc, o) => acc * o, 1)

    // Patas pendientes: cuota * probabilidad actual (sin empezar -> neutro ~1)
    let liveMult = 1
    for (const l of pending) {
      const m = byId.get(l.match_id)!
      const p = started(l) ? legWinProb(l, m, now) : 1 / Number(l.odds_taken)
      liveMult *= Number(l.odds_taken) * p
    }

    let value = Number(bet.stake) * lockedMult * liveMult * MARGIN
    value = Math.min(value, Number(bet.potential_payout))
    value = Math.max(0, round2(value))

    if (confirm) {
      const balance = await apply(db, bet_id, value)
      return json(200, { value, balance })
    }
    return json(200, { value })
  } catch (e) {
    console.error(e)
    return json(500, { error: String(e) })
  }
})

async function apply(db: ReturnType<typeof adminClient>, betId: string, value: number) {
  const { data, error } = await db.rpc('apply_cashout', { p_bet_id: betId, p_value: value })
  if (error) throw error
  return data as number
}
