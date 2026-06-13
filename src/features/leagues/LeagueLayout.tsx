import { useEffect, useState } from 'react'
import { NavLink, Outlet, useOutletContext, useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { fmtChips } from '../../lib/format'
import type { League } from '../../lib/database.types'
import Spinner from '../../components/Spinner'
import Avatar from '../../components/Avatar'
import LeagueMenu from './LeagueMenu'
import { BetSlipProvider } from '../betslip/BetSlipProvider'
import BetSlip from '../betslip/BetSlip'

export interface LeagueContext {
  league: League
  balance: number
  userId: string
}

export function useLeague() {
  return useOutletContext<LeagueContext>()
}

export default function LeagueLayout() {
  const { leagueId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [league, setLeague] = useState<League | null>(null)
  const [balance, setBalance] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function load() {
      const { data: l } = await supabase.from('leagues').select('*').eq('id', leagueId!).maybeSingle()
      const { data: m } = await supabase
        .from('league_members')
        .select('balance')
        .eq('league_id', leagueId!)
        .eq('user_id', user!.id)
        .maybeSingle()
      if (!active) return
      if (!l || !m) {
        navigate('/leagues', { replace: true })
        return
      }
      setLeague(l)
      setBalance(m.balance)
      setLoading(false)
    }
    load()
    return () => {
      active = false
    }
  }, [leagueId, user, navigate])

  // Realtime: el saldo se actualiza solo cuando se liquida una apuesta
  useEffect(() => {
    if (!leagueId || !user) return
    const channel = supabase
      .channel(`balance-${leagueId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'league_members',
          filter: `league_id=eq.${leagueId}`,
        },
        (payload) => {
          const row = payload.new as { user_id: string; balance: number }
          if (row.user_id === user.id) setBalance(row.balance)
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [leagueId, user])

  if (loading || !league) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <Spinner />
      </div>
    )
  }

  const ctx: LeagueContext = { league, balance, userId: user!.id }

  const isOwner = league.owner_id === user!.id

  return (
    <BetSlipProvider>
      {/* Barra lateral (solo escritorio) */}
      <aside className="hidden md:fixed md:inset-y-0 md:left-0 md:z-20 md:flex md:w-64 md:flex-col md:border-r md:border-slate-200 md:bg-white md:px-3 md:py-5 dark:md:border-slate-800 dark:md:bg-slate-900">
        <button
          onClick={() => navigate('/leagues')}
          className="mb-3 px-2 text-left text-sm text-slate-500 hover:text-brand dark:text-slate-400"
        >
          ‹ Mis ligas
        </button>
        <div className="mb-5 flex items-center gap-2 px-2">
          <Avatar url={league.image_url} name={league.name} size={40} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold text-slate-900 dark:text-white">{league.name}</div>
            <div className="text-sm font-bold text-brand">{fmtChips(balance)} fichas</div>
          </div>
          <LeagueMenu league={league} isOwner={isOwner} onChanged={setLeague} />
        </div>
        <nav className="flex flex-col gap-1">
          <SideTab to={`/l/${league.id}/partidos`} label="Partidos" icon="⚽️" />
          <SideTab to={`/l/${league.id}/apuestas`} label="Apuestas" icon="🎫" />
          <SideTab to={`/l/${league.id}/quinielas`} label="Quinielas" icon="📋" />
          <SideTab to={`/l/${league.id}/ranking`} label="Ranking" icon="🏆" />
          <SideTab to={`/l/${league.id}/chat`} label="Chat" icon="💬" />
          <SideTab to={`/l/${league.id}/actividad`} label="Actividad" icon="🔔" />
          <SideTab to="/perfil" label="Perfil" icon="👤" />
        </nav>
      </aside>

      {/* Columna principal */}
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col md:ml-64 md:max-w-none">
        {/* Barra superior (solo móvil) */}
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 md:hidden">
          <button onClick={() => navigate('/leagues')} className="shrink-0 text-sm text-slate-500 dark:text-slate-400">
            ‹
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-2 px-2">
            <Avatar url={league.image_url} name={league.name} size={28} />
            <div className="truncate font-semibold text-slate-900 dark:text-white">{league.name}</div>
          </div>
          <div className="shrink-0 text-right">
            <div className="font-bold leading-none text-brand">{fmtChips(balance)}</div>
            <div className="text-[10px] text-slate-500">fichas</div>
          </div>
          <div className="ml-1 shrink-0">
            <LeagueMenu league={league} isOwner={isOwner} onChanged={setLeague} />
          </div>
        </header>

        {/* Contenido */}
        <main className="flex-1 px-4 py-4 pb-32 md:px-8 md:py-8 md:pb-10">
          <div className="mx-auto w-full max-w-5xl">
            <Outlet context={ctx} />
          </div>
        </main>

        {/* Navegación inferior (solo móvil) */}
        <nav
          className="fixed bottom-0 left-1/2 z-10 w-full max-w-md -translate-x-1/2 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 md:hidden"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="grid grid-cols-7">
            <Tab to={`/l/${league.id}/partidos`} label="Partidos" icon="⚽️" />
            <Tab to={`/l/${league.id}/apuestas`} label="Apuestas" icon="🎫" />
            <Tab to={`/l/${league.id}/quinielas`} label="Quini." icon="📋" />
            <Tab to={`/l/${league.id}/ranking`} label="Ranking" icon="🏆" />
            <Tab to={`/l/${league.id}/chat`} label="Chat" icon="💬" />
            <Tab to={`/l/${league.id}/actividad`} label="Activid." icon="🔔" />
            <Tab to="/perfil" label="Perfil" icon="👤" />
          </div>
        </nav>

        {/* Hoja de apuesta (combinada) flotante */}
        <BetSlip league={league} balance={balance} />
      </div>
    </BetSlipProvider>
  )
}

function Tab({ to, label, icon }: { to: string; label: string; icon: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex flex-col items-center gap-0.5 py-2.5 text-[10px] ${
          isActive ? 'text-brand' : 'text-slate-500'
        }`
      }
    >
      <span className="text-base">{icon}</span>
      {label}
    </NavLink>
  )
}

function SideTab({ to, label, icon }: { to: string; label: string; icon: string }) {
  return (
    <NavLink
      end
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
          isActive
            ? 'bg-brand/15 text-brand'
            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
        }`
      }
    >
      <span className="text-lg">{icon}</span>
      {label}
    </NavLink>
  )
}
