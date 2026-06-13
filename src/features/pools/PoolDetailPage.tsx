import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useLeague } from '../leagues/LeagueLayout'
import { fmtChips } from '../../lib/format'
import { localizeMatch } from '../../lib/teams'
import type { Match, Pool, PoolEntry, PoolPrediction, Profile } from '../../lib/database.types'
import { captureError } from '../../lib/monitoring'
import Avatar from '../../components/Avatar'
import Spinner from '../../components/Spinner'

type Prof = Pick<Profile, 'id' | 'display_name' | 'avatar_url'>
type Score = { home: number; away: number }

export default function PoolDetailPage() {
  const { poolId } = useParams()
  const { league, balance, userId } = useLeague()
  const navigate = useNavigate()
  const isOwner = league.owner_id === userId

  const [pool, setPool] = useState<Pool | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [entries, setEntries] = useState<PoolEntry[]>([])
  const [profiles, setProfiles] = useState<Map<string, Prof>>(new Map())
  const [points, setPoints] = useState<Map<string, number>>(new Map())
  const [myPreds, setMyPreds] = useState<Map<string, PoolPrediction>>(new Map())
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Formulario de predicciones (marcador por partido).
  const [form, setForm] = useState<Record<string, Score>>({})

  const myEntry = useMemo(() => entries.find((e) => e.user_id === userId) ?? null, [entries, userId])
  const joined = !!myEntry
  const started = useMemo(
    () => matches.length > 0 && matches.some((m) => new Date(m.commence_time).getTime() <= Date.now()),
    [matches],
  )

  const load = useCallback(async () => {
    const { data: p } = await supabase.from('pools').select('*').eq('id', poolId!).maybeSingle()
    if (!p) {
      navigate(`/l/${league.id}/quinielas`, { replace: true })
      return
    }
    setPool(p as Pool)

    const { data: pm } = await supabase.from('pool_matches').select('match_id').eq('pool_id', poolId!)
    const ids = (pm ?? []).map((x) => x.match_id)
    if (ids.length > 0) {
      const { data: ms } = await supabase.from('matches').select('*').in('id', ids)
      setMatches((ms ?? []).map(localizeMatch).sort((a, b) => a.commence_time.localeCompare(b.commence_time)))
    }

    const { data: es } = await supabase.from('pool_entries').select('*').eq('pool_id', poolId!)
    const elist = (es ?? []) as PoolEntry[]
    setEntries(elist)
    if (elist.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', elist.map((e) => e.user_id))
      setProfiles(new Map((profs ?? []).map((x) => [x.id, x as Prof])))
    }

    const { data: res } = await supabase.rpc('pool_results', { p_pool_id: poolId! })
    setPoints(new Map(((res ?? []) as { user_id: string; points: number }[]).map((r) => [r.user_id, r.points])))

    const mine = elist.find((e) => e.user_id === userId)
    if (mine) {
      const { data: preds } = await supabase.from('pool_predictions').select('*').eq('entry_id', mine.id)
      setMyPreds(new Map(((preds ?? []) as PoolPrediction[]).map((pr) => [pr.match_id, pr])))
    }
    setLoading(false)
  }, [poolId, league.id, navigate, userId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const channel = supabase
      .channel(`pool-${poolId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pools', filter: `id=eq.${poolId}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pool_entries', filter: `pool_id=eq.${poolId}` }, () => load())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [poolId, load])

  function setScore(matchId: string, side: 'home' | 'away', value: number) {
    setForm((prev) => {
      const cur = prev[matchId] ?? { home: 0, away: 0 }
      return { ...prev, [matchId]: { ...cur, [side]: Math.max(0, value) } }
    })
  }

  async function join() {
    setBusy(true)
    setError(null)
    const predictions = matches.map((m) => ({
      match_id: m.id,
      home: form[m.id]?.home ?? 0,
      away: form[m.id]?.away ?? 0,
    }))
    const { error } = await supabase.rpc('join_pool', { p_pool_id: poolId!, p_predictions: predictions })
    setBusy(false)
    if (error) {
      captureError(error, 'join_pool')
      return setError(error.message)
    }
    load()
  }

  async function ownerAction(rpc: 'lock_pool' | 'settle_pool') {
    setBusy(true)
    setError(null)
    const { error } = await supabase.rpc(rpc, { p_pool_id: poolId! })
    setBusy(false)
    if (error) {
      captureError(error, rpc)
      return setError(error.message)
    }
    load()
  }

  if (loading || !pool) return <Spinner label="Cargando quiniela..." />

  const n = entries.length
  const pot = pool.entry_fee * n
  const maxPoints = entries.length > 0 ? Math.max(...entries.map((e) => points.get(e.user_id) ?? 0)) : 0
  const standings = [...entries].sort(
    (a, b) => (points.get(b.user_id) ?? 0) - (points.get(a.user_id) ?? 0) || a.paid_at.localeCompare(b.paid_at),
  )
  const canJoin = pool.status === 'open' && !joined && !started

  return (
    <div className="space-y-4">
      <button onClick={() => navigate(`/l/${league.id}/quinielas`)} className="text-sm text-slate-500 hover:text-brand">
        ‹ Quinielas
      </button>

      <div className="card">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">{pool.name}</h1>
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {pool.status === 'open' ? 'Abierta' : pool.status === 'locked' ? 'En juego' : 'Liquidada'}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-slate-500 dark:text-slate-400">
            {n} {n === 1 ? 'participante' : 'participantes'} · Entrada {fmtChips(pool.entry_fee)}
          </span>
          <span className="font-bold text-brand">Bote {fmtChips(pot)}</span>
        </div>
      </div>

      {/* Controles del owner */}
      {isOwner && pool.status !== 'settled' && (
        <div className="card space-y-2 border-amber-400/40">
          <p className="text-xs text-slate-500">Controles del organizador</p>
          <div className="flex gap-2">
            {pool.status === 'open' && (
              <button className="btn-ghost flex-1 py-2 text-sm" onClick={() => ownerAction('lock_pool')} disabled={busy}>
                🔒 Cerrar inscripciones
              </button>
            )}
            <button className="btn-primary flex-1 py-2 text-sm" onClick={() => ownerAction('settle_pool')} disabled={busy}>
              💰 Liquidar y repartir bote
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {/* Formulario de participación */}
      {canJoin ? (
        <div className="card space-y-3">
          <h2 className="font-semibold text-slate-900 dark:text-white">Tus pronósticos</h2>
          {matches.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-2">
              <span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-200">{m.home_team}</span>
              <input
                type="number"
                min={0}
                className="input w-12 px-0 text-center"
                value={form[m.id]?.home ?? 0}
                onChange={(e) => setScore(m.id, 'home', Math.floor(Number(e.target.value)))}
              />
              <span className="text-slate-400">-</span>
              <input
                type="number"
                min={0}
                className="input w-12 px-0 text-center"
                value={form[m.id]?.away ?? 0}
                onChange={(e) => setScore(m.id, 'away', Math.floor(Number(e.target.value)))}
              />
              <span className="min-w-0 flex-1 truncate text-right text-sm text-slate-700 dark:text-slate-200">{m.away_team}</span>
            </div>
          ))}
          <button
            className="btn-primary w-full"
            disabled={busy || balance < pool.entry_fee}
            onClick={join}
          >
            {balance < pool.entry_fee
              ? 'Fichas insuficientes'
              : `Participar · ${fmtChips(pool.entry_fee)} fichas`}
          </button>
        </div>
      ) : (
        !joined &&
        pool.status === 'open' &&
        started && (
          <div className="card text-center text-sm text-slate-500 dark:text-slate-400">
            La quiniela ya ha comenzado; no admite nuevos participantes.
          </div>
        )
      )}

      {/* Mis pronósticos (si ya participo) */}
      {joined && myPreds.size > 0 && (
        <div className="card">
          <h2 className="mb-2 font-semibold text-slate-900 dark:text-white">Tus pronósticos</h2>
          <div className="space-y-1.5">
            {matches.map((m) => {
              const pr = myPreds.get(m.id)
              const finished = m.status === 'finished' && m.home_score != null
              return (
                <div key={m.id} className="flex items-center justify-between text-sm">
                  <span className="min-w-0 flex-1 truncate text-slate-600 dark:text-slate-300">
                    {m.home_team} vs {m.away_team}
                  </span>
                  <span className="ml-2 shrink-0 font-semibold text-slate-900 dark:text-white">
                    {pr ? `${pr.pred_home}-${pr.pred_away}` : '—'}
                  </span>
                  {finished && (
                    <span className="ml-2 shrink-0 text-xs text-slate-400">
                      (real {m.home_score}-{m.away_score})
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Clasificación */}
      {n > 0 && (
        <div className="card">
          <h2 className="mb-2 font-semibold text-slate-900 dark:text-white">Clasificación</h2>
          <div className="space-y-1">
            {standings.map((e, i) => {
              const p = profiles.get(e.user_id)
              const pts = points.get(e.user_id) ?? 0
              const isLeader = pts === maxPoints && maxPoints > 0
              return (
                <div key={e.id} className="flex items-center gap-2 py-1">
                  <span className="w-5 text-center text-sm text-slate-400">{i + 1}</span>
                  <Avatar url={p?.avatar_url} name={p?.display_name} size={26} />
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-900 dark:text-white">
                    {p?.display_name ?? '—'}
                    {e.user_id === userId && <span className="text-slate-400"> (tú)</span>}
                  </span>
                  <span className={`shrink-0 text-sm font-bold ${isLeader ? 'text-brand' : 'text-slate-500'}`}>
                    {isLeader && pool.status === 'settled' && <span className="mr-0.5">👑</span>}
                    {pts} pts
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
