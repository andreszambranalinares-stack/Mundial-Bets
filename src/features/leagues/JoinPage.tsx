import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import type { LeaguePublic } from '../../lib/database.types'
import Avatar from '../../components/Avatar'
import Logo from '../../components/Logo'
import Spinner from '../../components/Spinner'

const PENDING_KEY = 'fb-pending-invite'

export default function JoinPage() {
  const { code } = useParams()
  const { session } = useAuth()
  const navigate = useNavigate()
  const [league, setLeague] = useState<LeaguePublic | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.rpc('get_league_by_invite', { p_invite_code: code ?? '' })
      const row = (data as LeaguePublic[] | null)?.[0] ?? null
      setLeague(row)
      setLoading(false)
    }
    load()
  }, [code])

  async function join() {
    if (!code) return
    // Sin sesión: guardamos el código y mandamos a login/registro
    if (!session) {
      localStorage.setItem(PENDING_KEY, code)
      navigate('/')
      return
    }
    setBusy(true)
    setError(null)
    const { data, error } = await supabase.rpc('join_league', { p_invite_code: code })
    setBusy(false)
    if (error) return setError(error.message)
    navigate(`/l/${(data as { id: string }).id}/partidos`, { replace: true })
  }

  if (loading) return <Spinner />

  return (
    <div className="mx-auto flex min-h-full max-w-sm flex-col justify-center px-6 py-10">
      <div className="mb-8 flex justify-center">
        <Logo size={64} />
      </div>

      {!league ? (
        <div className="card text-center">
          <p className="text-slate-700 dark:text-slate-300">Este enlace de invitación no es válido.</p>
          <button className="btn-ghost mt-4 w-full" onClick={() => navigate('/')}>
            Ir al inicio
          </button>
        </div>
      ) : (
        <div className="card flex flex-col items-center text-center">
          <Avatar url={league.image_url} name={league.name} size={88} />
          <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">{league.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {league.members} {league.members === 1 ? 'miembro' : 'miembros'}
          </p>

          {error && <p className="mt-3 text-sm text-red-500 dark:text-red-400">{error}</p>}

          {!league.invite_active ? (
            <p className="mt-5 text-sm text-amber-600 dark:text-amber-400">
              El enlace de invitación de esta liga está desactivado.
            </p>
          ) : (
            <button className="btn-primary mt-5 w-full" disabled={busy} onClick={join}>
              {busy ? '...' : session ? 'Unirme a la liga' : 'Inicia sesión para unirte'}
            </button>
          )}

          <button className="mt-3 text-sm text-slate-500 underline" onClick={() => navigate('/')}>
            Cancelar
          </button>
        </div>
      )}
    </div>
  )
}
