import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useLeague } from '../leagues/LeagueLayout'
import { fmtChips, fmtTimeAgo } from '../../lib/format'
import type { LeagueActivity, Profile } from '../../lib/database.types'
import Avatar from '../../components/Avatar'
import Spinner from '../../components/Spinner'

type Prof = Pick<Profile, 'id' | 'display_name' | 'avatar_url'>

const ICON: Record<string, string> = {
  member_joined: '🤝',
  bet_placed: '🎫',
  bet_won: '✅',
  bet_lost: '❌',
  pool_joined: '📋',
  pool_settled: '💰',
  jornada_recap: '📰',
}

function actionText(a: LeagueActivity): string {
  const p = a.payload as {
    num_legs?: number
    stake?: number
    payout?: number
    name?: string
    entry_fee?: number
    pot?: number
  }
  switch (a.type) {
    case 'member_joined':
      return 'se unió a la liga'
    case 'bet_placed':
      return (p.num_legs ?? 1) > 1
        ? `hizo una combinada de ${p.num_legs} partidos · ${fmtChips(p.stake ?? 0)} fichas`
        : `hizo una apuesta · ${fmtChips(p.stake ?? 0)} fichas`
    case 'bet_won':
      return `ganó una apuesta · +${fmtChips(p.payout ?? 0)} fichas`
    case 'bet_lost':
      return 'falló una apuesta'
    case 'pool_joined':
      return `se apuntó a la quiniela «${p.name ?? ''}» · ${fmtChips(p.entry_fee ?? 0)} fichas`
    case 'pool_settled':
      return `liquidó la quiniela «${p.name ?? ''}» · bote ${fmtChips(p.pot ?? 0)} fichas`
    default:
      return ''
  }
}

export default function ActivityPage() {
  const { league } = useLeague()
  const [items, setItems] = useState<LeagueActivity[]>([])
  const [profiles, setProfiles] = useState<Map<string, Prof>>(new Map())
  const [loading, setLoading] = useState(true)

  const loadProfiles = useCallback(async () => {
    const { data: members } = await supabase
      .from('league_members')
      .select('user_id')
      .eq('league_id', league.id)
    const ids = (members ?? []).map((m) => m.user_id)
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', ids)
    setProfiles(new Map((profs ?? []).map((p) => [p.id, p as Prof])))
  }, [league.id])

  useEffect(() => {
    async function load() {
      await loadProfiles()
      const { data } = await supabase
        .from('league_activity')
        .select('*')
        .eq('league_id', league.id)
        .order('created_at', { ascending: false })
        .limit(100)
      setItems((data ?? []) as LeagueActivity[])
      setLoading(false)
    }
    load()
  }, [league.id, loadProfiles])

  useEffect(() => {
    const channel = supabase
      .channel(`activity-${league.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'league_activity', filter: `league_id=eq.${league.id}` },
        (payload) => {
          const item = payload.new as LeagueActivity
          setItems((prev) => (prev.some((i) => i.id === item.id) ? prev : [item, ...prev]))
          setProfiles((prev) => {
            if (!prev.has(item.user_id)) loadProfiles()
            return prev
          })
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [league.id, loadProfiles])

  if (loading) return <Spinner />
  if (items.length === 0)
    return (
      <div className="card text-center text-sm text-slate-500 dark:text-slate-400">
        Todavía no hay actividad en la liga.
      </div>
    )

  return (
    <div className="space-y-2">
      {items.map((a) => {
        if (a.type === 'jornada_recap') return <RecapCard key={a.id} a={a} profiles={profiles} />
        const p = profiles.get(a.user_id)
        return (
          <div key={a.id} className="card flex items-center gap-3 py-3">
            <div className="relative shrink-0">
              <Avatar url={p?.avatar_url} name={p?.display_name} size={40} />
              <span className="absolute -bottom-1 -right-1 text-base">{ICON[a.type]}</span>
            </div>
            <div className="min-w-0 flex-1 text-sm">
              <span className="font-semibold text-slate-900 dark:text-white">{p?.display_name ?? '—'}</span>{' '}
              <span className="text-slate-600 dark:text-slate-300">{actionText(a)}</span>
            </div>
            <span className="shrink-0 text-xs text-slate-400">{fmtTimeAgo(a.created_at)}</span>
          </div>
        )
      })}
    </div>
  )
}

function RecapCard({ a, profiles }: { a: LeagueActivity; profiles: Map<string, Prof> }) {
  const p = a.payload as {
    date?: string
    winner_id?: string
    winner_net?: number
    loser_id?: string
    loser_net?: number
    top_odds?: number
    top_user?: string
  }
  const name = (id?: string) => (id ? profiles.get(id)?.display_name ?? '—' : '—')
  const dateLabel = p.date
    ? new Date(p.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
    : ''
  return (
    <div className="card space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-slate-900 dark:text-white">📰 Resumen de la jornada</span>
        <span className="text-xs text-slate-400">{dateLabel}</span>
      </div>
      {p.winner_id && (p.winner_net ?? 0) > 0 && (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          👑 Mejor del día: <span className="font-semibold">{name(p.winner_id)}</span> (+{fmtChips(p.winner_net ?? 0)})
        </p>
      )}
      {p.loser_id && (p.loser_net ?? 0) < 0 && p.loser_id !== p.winner_id && (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          💸 Peor del día: <span className="font-semibold">{name(p.loser_id)}</span> ({fmtChips(p.loser_net ?? 0)})
        </p>
      )}
      {p.top_user && (p.top_odds ?? 0) > 1 && (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          🎯 Mayor batacazo: <span className="font-semibold">{name(p.top_user)}</span> @ {(p.top_odds ?? 0).toFixed(2)}
        </p>
      )}
    </div>
  )
}
