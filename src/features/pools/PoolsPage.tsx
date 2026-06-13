import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useLeague } from '../leagues/LeagueLayout'
import { fmtChips } from '../../lib/format'
import { localizeMatch } from '../../lib/teams'
import type { Match, Pool, PoolStatus } from '../../lib/database.types'
import { captureError } from '../../lib/monitoring'
import Spinner from '../../components/Spinner'
import FuturesSection from './FuturesSection'

const STATUS_BADGE: Record<PoolStatus, { label: string; cls: string }> = {
  open: { label: 'Abierta', cls: 'bg-brand/15 text-brand' },
  locked: { label: 'En juego', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  settled: { label: 'Liquidada', cls: 'bg-slate-500/15 text-slate-500 dark:text-slate-400' },
}

export default function PoolsPage() {
  const { league, userId } = useLeague()
  const navigate = useNavigate()
  const isOwner = league.owner_id === userId
  const [pools, setPools] = useState<Pool[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('pools')
      .select('*')
      .eq('league_id', league.id)
      .order('created_at', { ascending: false })
    const list = (data ?? []) as Pool[]
    setPools(list)
    if (list.length > 0) {
      const { data: entries } = await supabase
        .from('pool_entries')
        .select('pool_id')
        .in('pool_id', list.map((p) => p.id))
      const c: Record<string, number> = {}
      for (const e of entries ?? []) c[e.pool_id] = (c[e.pool_id] ?? 0) + 1
      setCounts(c)
    }
    setLoading(false)
  }, [league.id])

  useEffect(() => {
    load()
  }, [load])

  // Realtime: refresca cuando se crean quinielas o se apunta gente.
  useEffect(() => {
    const channel = supabase
      .channel(`pools-${league.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pools', filter: `league_id=eq.${league.id}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pool_entries' }, () => load())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [league.id, load])

  if (loading) return <Spinner label="Cargando quinielas..." />

  return (
    <div className="space-y-4">
      <FuturesSection />

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          Predice los marcadores de la jornada. Acertar el resultado exacto da 3 puntos; acertar solo el
          1X2, 1 punto. El bote se reparte entre quienes más puntúen.
        </p>
      </div>

      {isOwner && (
        <button className="btn-primary w-full" onClick={() => setCreating(true)}>
          + Crear quiniela
        </button>
      )}

      {pools.length === 0 ? (
        <div className="card text-center text-sm text-slate-500 dark:text-slate-400">
          Aún no hay quinielas en esta liga.
          {isOwner ? ' ¡Crea la primera!' : ' El creador de la liga puede abrir una.'}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {pools.map((p) => {
            const n = counts[p.id] ?? 0
            const badge = STATUS_BADGE[p.status]
            return (
              <button
                key={p.id}
                onClick={() => navigate(`/l/${league.id}/quinielas/${p.id}`)}
                className="card text-left transition hover:border-brand/50"
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="truncate font-semibold text-slate-900 dark:text-white">{p.name}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${badge.cls}`}>
                    {badge.label}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
                  <span>
                    {n} {n === 1 ? 'participante' : 'participantes'}
                  </span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    Bote {fmtChips(p.entry_fee * n)}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-400">Entrada: {fmtChips(p.entry_fee)} fichas</div>
              </button>
            )
          })}
        </div>
      )}

      {creating && (
        <CreatePoolModal
          leagueId={league.id}
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false)
            navigate(`/l/${league.id}/quinielas/${id}`)
          }}
        />
      )}
    </div>
  )
}

function CreatePoolModal({
  leagueId,
  onClose,
  onCreated,
}: {
  leagueId: string
  onClose: () => void
  onCreated: (poolId: string) => void
}) {
  const [name, setName] = useState('Quiniela de la jornada')
  const [entryFee, setEntryFee] = useState(100)
  const [matches, setMatches] = useState<Match[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('matches')
        .select('*')
        .eq('status', 'scheduled')
        .gt('commence_time', new Date().toISOString())
        .order('commence_time', { ascending: true })
        .limit(60)
      setMatches((data ?? []).map(localizeMatch))
      setLoading(false)
    }
    load()
  }, [])

  // Fecha de jornada = día del primer partido seleccionado.
  const jornadaDate = useMemo(() => {
    const picked = matches.filter((m) => selected.has(m.id))
    if (picked.length === 0) return null
    const first = picked.reduce((a, b) => (a.commence_time < b.commence_time ? a : b))
    return first.commence_time.slice(0, 10)
  }, [matches, selected])

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function create() {
    setBusy(true)
    setError(null)
    const { data, error } = await supabase.rpc('create_pool', {
      p_league_id: leagueId,
      p_name: name.trim() || 'Quiniela',
      p_jornada_date: jornadaDate,
      p_entry_fee: entryFee,
      p_match_ids: [...selected],
    })
    setBusy(false)
    if (error) {
      captureError(error, 'create_pool')
      return setError(error.message)
    }
    onCreated((data as Pool).id)
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 md:items-center" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col rounded-t-3xl border-t border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900 md:rounded-3xl md:border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 shrink-0 rounded-full bg-slate-300 dark:bg-slate-700" />
        <h3 className="mb-3 shrink-0 font-semibold text-slate-900 dark:text-white">Nueva quiniela</h3>

        <label className="label">Nombre</label>
        <input className="input mb-3" value={name} onChange={(e) => setName(e.target.value)} />

        <label className="label">Entrada (fichas)</label>
        <input
          type="number"
          min={1}
          className="input mb-3"
          value={entryFee}
          onChange={(e) => setEntryFee(Math.max(1, Math.floor(Number(e.target.value))))}
        />

        <label className="label">Partidos ({selected.size} seleccionados)</label>
        <div className="mb-4 min-h-0 flex-1 space-y-2 overflow-y-auto">
          {loading ? (
            <Spinner />
          ) : matches.length === 0 ? (
            <p className="text-sm text-slate-500">No hay partidos próximos.</p>
          ) : (
            matches.map((m) => (
              <label
                key={m.id}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 ${
                  selected.has(m.id)
                    ? 'border-brand bg-brand/10'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggle(m.id)} className="accent-brand" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-slate-900 dark:text-white">
                    {m.home_team} vs {m.away_team}
                  </div>
                  <div className="text-xs text-slate-500">
                    {new Date(m.commence_time).toLocaleString('es-ES', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </label>
            ))
          )}
        </div>

        {error && <p className="mb-3 shrink-0 text-sm text-red-400">{error}</p>}

        <div className="flex shrink-0 gap-2">
          <button className="btn-ghost flex-1 py-2.5" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button className="btn-primary flex-1 py-2.5" onClick={create} disabled={busy || selected.size === 0}>
            {busy ? '...' : 'Crear'}
          </button>
        </div>
      </div>
    </div>
  )
}
