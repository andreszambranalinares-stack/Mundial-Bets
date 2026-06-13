import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { fmtChips } from '../../lib/format'
import type { League, LeagueMember } from '../../lib/database.types'
import Spinner from '../../components/Spinner'
import Logo from '../../components/Logo'
import Avatar from '../../components/Avatar'

type LeagueWithBalance = League & { balance: number }

export default function LeaguesPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [leagues, setLeagues] = useState<LeagueWithBalance[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const imageRef = useRef<HTMLInputElement>(null)

  async function load() {
    setLoading(true)
    const { data: members } = await supabase
      .from('league_members')
      .select('league_id, balance')
      .eq('user_id', user!.id)
    const ids = (members ?? []).map((m) => m.league_id)
    if (ids.length === 0) {
      setLeagues([])
      setLoading(false)
      return
    }
    const { data: ls } = await supabase.from('leagues').select('*').in('id', ids)
    const balanceById = new Map((members as LeagueMember[]).map((m) => [m.league_id, m.balance]))
    setLeagues((ls ?? []).map((l) => ({ ...l, balance: balanceById.get(l.id) ?? 0 })))
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImage(file)
    setImagePreview(URL.createObjectURL(file))
  }

  async function createLeague() {
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    const { data, error } = await supabase.rpc('create_league', { p_name: name.trim() })
    if (error) {
      setBusy(false)
      return setError(error.message)
    }
    const league = data as League

    // Subir imagen (opcional) una vez creada la liga (ya somos el owner)
    if (image) {
      try {
        const ext = image.name.split('.').pop()?.toLowerCase() || 'jpg'
        const path = `${league.id}/img_${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('league-images')
          .upload(path, image, { upsert: true, cacheControl: '3600' })
        if (upErr) {
          console.error('Error al subir la imagen de la liga:', upErr)
        } else {
          const url = supabase.storage.from('league-images').getPublicUrl(path).data.publicUrl
          await supabase.rpc('set_league_image', { p_league_id: league.id, p_image_url: url })
        }
      } catch (err) {
        /* si falla la imagen, la liga ya está creada igualmente */
        console.error('Error al subir la imagen de la liga:', err)
      }
    }

    setBusy(false)
    navigate(`/l/${league.id}/partidos`)
  }

  async function joinLeague() {
    if (!code.trim()) return
    setBusy(true)
    setError(null)
    const { data, error } = await supabase.rpc('join_league', { p_invite_code: code.trim() })
    setBusy(false)
    if (error) return setError(error.message)
    navigate(`/l/${(data as League).id}/partidos`)
  }

  return (
    <div className="mx-auto max-w-md px-5 py-6">
      <div className="mb-6 flex items-center justify-between">
        <Logo size={44} />
        <button className="text-sm text-slate-400 underline" onClick={signOut}>
          Salir
        </button>
      </div>
      <h1 className="mb-4 text-xl font-bold text-slate-900 dark:text-white">Tus ligas</h1>

      {loading ? (
        <Spinner />
      ) : leagues.length === 0 ? (
        <p className="mb-6 text-sm text-slate-400">
          Aún no estás en ninguna liga. Crea una nueva o únete con un código.
        </p>
      ) : (
        <div className="mb-6 space-y-3">
          {leagues.map((l) => (
            <button
              key={l.id}
              onClick={() => navigate(`/l/${l.id}/partidos`)}
              className="card flex w-full items-center justify-between gap-3 text-left hover:border-brand/50"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar url={l.image_url} name={l.name} size={44} />
                <div className="min-w-0">
                  <div className="truncate font-semibold text-slate-900 dark:text-white">{l.name}</div>
                  <div className="text-xs text-slate-500">Código: {l.invite_code}</div>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-bold text-brand">{fmtChips(l.balance)}</div>
                <div className="text-xs text-slate-500">fichas</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      <div className="card mb-3 space-y-2">
        <label className="label">Crear una liga nueva</label>
        <div className="flex items-center gap-3">
          <input ref={imageRef} type="file" accept="image/*" hidden onChange={onPickImage} />
          <button
            type="button"
            onClick={() => imageRef.current?.click()}
            className="shrink-0"
            aria-label="Añadir imagen de la liga"
          >
            <Avatar url={imagePreview} name={name || '?'} size={48} />
          </button>
          <input
            className="input flex-1"
            placeholder="Nombre de la liga"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <p className="text-xs text-slate-500">Toca el círculo para añadir una imagen (opcional).</p>
        <button className="btn-primary w-full" disabled={busy} onClick={createLeague}>
          {busy ? '...' : 'Crear liga'}
        </button>
      </div>

      <div className="card space-y-2">
        <label className="label">Unirte con un código</label>
        <input
          className="input uppercase"
          placeholder="Código (ej: ABC123)"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />
        <button className="btn-ghost w-full" disabled={busy} onClick={joinLeague}>
          Unirme
        </button>
      </div>
    </div>
  )
}
