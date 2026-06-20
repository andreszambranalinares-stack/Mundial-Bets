import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { useAuth } from './features/auth/AuthProvider'
import { supabase } from './lib/supabase'
import LoginPage from './features/auth/LoginPage'
import LeaguesPage from './features/leagues/LeaguesPage'
import LeagueLayout from './features/leagues/LeagueLayout'
import JoinPage from './features/leagues/JoinPage'
import MatchesPage from './features/matches/MatchesPage'
import MatchDetailPage from './features/matches/MatchDetailPage'
import MyBetsPage from './features/bets/MyBetsPage'
import PoolsPage from './features/pools/PoolsPage'
import PoolDetailPage from './features/pools/PoolDetailPage'
import RoulettePage from './features/roulette/RoulettePage'
import LeaderboardPage from './features/leaderboard/LeaderboardPage'
import ChatPage from './features/chat/ChatPage'
import ActivityPage from './features/activity/ActivityPage'
import ProfilePage from './features/profile/ProfilePage'
import AdminPage from './features/admin/AdminPage'
import OnboardingPage from './features/onboarding/OnboardingPage'
import Spinner from './components/Spinner'
import Logo from './components/Logo'

const PENDING_INVITE_KEY = 'fb-pending-invite'

export default function App() {
  const { session, user, loading } = useAuth()
  const navigate = useNavigate()
  // null = aún comprobando; true/false = onboarding visto o no
  const [onboarded, setOnboarded] = useState<boolean | null>(null)

  // Auto-unión a una liga si se llegó por un enlace de invitación sin sesión
  // (el código se guardó antes de mandar a login/registro).
  useEffect(() => {
    if (!user) return
    const code = localStorage.getItem(PENDING_INVITE_KEY)
    if (!code) return
    localStorage.removeItem(PENDING_INVITE_KEY)
    supabase.rpc('join_league', { p_invite_code: code }).then(({ data, error }) => {
      if (!error && data) navigate(`/l/${(data as { id: string }).id}/partidos`)
    })
  }, [user, navigate])

  useEffect(() => {
    if (!user) {
      setOnboarded(null)
      return
    }
    let active = true
    supabase
      .from('profiles')
      .select('onboarding_done')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setOnboarded(data?.onboarding_done ?? false)
      })
    return () => {
      active = false
    }
  }, [user])

  async function finishOnboarding() {
    setOnboarded(true)
    if (user) await supabase.from('profiles').update({ onboarding_done: true }).eq('id', user.id)
  }

  if (loading) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-6">
        <Logo size={160} className="animate-pulse" />
        <Spinner />
      </div>
    )
  }

  if (!session) {
    return (
      <Routes>
        <Route path="/unirse/:code" element={<JoinPage />} />
        <Route path="*" element={<LoginPage />} />
      </Routes>
    )
  }

  // Sesión iniciada: esperamos a saber si ya vio el onboarding
  if (onboarded === null) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-6">
        <Logo size={160} className="animate-pulse" />
        <Spinner />
      </div>
    )
  }

  if (!onboarded) {
    return <OnboardingPage onFinish={finishOnboarding} />
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/leagues" replace />} />
      <Route path="/leagues" element={<LeaguesPage />} />
      <Route path="/unirse/:code" element={<JoinPage />} />
      <Route path="/perfil" element={<ProfilePage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/l/:leagueId" element={<LeagueLayout />}>
        <Route index element={<Navigate to="partidos" replace />} />
        <Route path="partidos" element={<MatchesPage />} />
        <Route path="partido/:matchId" element={<MatchDetailPage />} />
        <Route path="apuestas" element={<MyBetsPage />} />
        <Route path="quinielas" element={<PoolsPage />} />
        <Route path="quinielas/:poolId" element={<PoolDetailPage />} />
        <Route path="ruleta" element={<RoulettePage />} />
        <Route path="ranking" element={<LeaderboardPage />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="actividad" element={<ActivityPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/leagues" replace />} />
    </Routes>
  )
}
