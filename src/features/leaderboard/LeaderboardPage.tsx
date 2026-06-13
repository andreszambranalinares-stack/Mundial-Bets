import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useLeague } from '../leagues/LeagueLayout'
import { fmtChips } from '../../lib/format'
import Spinner from '../../components/Spinner'
import Avatar from '../../components/Avatar'
import LeagueHistory from './LeagueHistory'

interface Row {
  user_id: string
  balance: number
  display_name: string
  avatar_url: string | null
}

export default function LeaderboardPage() {
  const { league, userId } = useLeague()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [view, setView] = useState<'ranking' | 'history'>('ranking')

  const load = useCallback(async () => {
    const { data: members } = await supabase
      .from('league_members')
      .select('user_id, balance')
      .eq('league_id', league.id)
    const list = members ?? []
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', list.map((m) => m.user_id))
    const profById = new Map((profiles ?? []).map((p) => [p.id, p]))
    const merged: Row[] = list
      .map((m) => ({
        user_id: m.user_id,
        balance: m.balance,
        display_name: profById.get(m.user_id)?.display_name ?? '—',
        avatar_url: profById.get(m.user_id)?.avatar_url ?? null,
      }))
      .sort((a, b) => b.balance - a.balance)
    setRows(merged)
    setLoading(false)
  }, [league.id])

  useEffect(() => {
    load()
  }, [load])

  // Realtime: cualquier cambio de saldo en la liga refresca el ranking
  useEffect(() => {
    const channel = supabase
      .channel(`leaderboard-${league.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'league_members', filter: `league_id=eq.${league.id}` },
        () => load(),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [league.id, load])

  function shareCode() {
    navigator.clipboard?.writeText(league.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="space-y-4">
      <button onClick={shareCode} className="card flex w-full items-center justify-between text-left">
        <div>
          <div className="text-xs text-slate-400">Código de la liga (toca para copiar)</div>
          <div className="text-lg font-bold tracking-widest text-slate-900 dark:text-white">{league.invite_code}</div>
        </div>
        <span className="text-sm text-brand">{copied ? '¡Copiado!' : 'Compartir'}</span>
      </button>

      {/* Selector Clasificación / Historial */}
      <div className="flex gap-2">
        <ViewBtn active={view === 'ranking'} onClick={() => setView('ranking')}>Clasificación</ViewBtn>
        <ViewBtn active={view === 'history'} onClick={() => setView('history')}>Historial</ViewBtn>
      </div>

      {view === 'history' ? (
        <LeagueHistory />
      ) : loading ? (
        <Spinner />
      ) : (
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div
              key={r.user_id}
              className={`card flex items-center justify-between ${
                r.user_id === userId ? 'border-brand/50' : ''
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="w-6 shrink-0 text-center text-lg">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                </span>
                <Avatar url={r.avatar_url} name={r.display_name} size={36} />
                <span className="truncate font-semibold text-slate-900 dark:text-white">
                  {r.display_name}
                  {r.user_id === userId && <span className="text-slate-500"> (tú)</span>}
                </span>
              </div>
              <span className="font-bold text-brand">{fmtChips(r.balance)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ViewBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-full px-3 py-1.5 text-sm font-medium transition ${
        active
          ? 'bg-brand text-slate-900'
          : 'bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
      }`}
    >
      {children}
    </button>
  )
}
