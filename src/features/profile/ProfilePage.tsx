import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { useTheme } from '../../lib/theme'
import Avatar from '../../components/Avatar'
import PasswordInput from '../../components/PasswordInput'
import Spinner from '../../components/Spinner'

export default function ProfilePage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()

  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  // Avatar pendiente de guardar (preview local antes de subir)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Cambio de contraseña
  const [pwd, setPwd] = useState('')
  const [savingPwd, setSavingPwd] = useState(false)
  const [pwdMsg, setPwdMsg] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('profiles')
        .select('display_name, avatar_url')
        .eq('id', user!.id)
        .maybeSingle()
      if (data) {
        setName(data.display_name ?? '')
        setAvatarUrl(data.avatar_url)
      }
      // ¿Eres admin? Lo eres si has creado (eres owner de) alguna liga.
      const { count } = await supabase
        .from('leagues')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', user!.id)
      setIsAdmin((count ?? 0) > 0)
      setLoading(false)
    }
    load()
  }, [user])

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPendingFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setProfileMsg(null)
    setError(null)
  }

  async function saveProfile() {
    setSavingProfile(true)
    setError(null)
    setProfileMsg(null)
    try {
      let newAvatarUrl = avatarUrl

      if (pendingFile) {
        const ext = pendingFile.name.split('.').pop()?.toLowerCase() || 'jpg'
        const path = `${user!.id}/avatar_${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('avatars')
          .upload(path, pendingFile, { upsert: true, cacheControl: '3600' })
        if (upErr) throw upErr
        newAvatarUrl = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
      }

      const { error: updErr } = await supabase
        .from('profiles')
        .update({ display_name: name.trim(), avatar_url: newAvatarUrl })
        .eq('id', user!.id)
      if (updErr) throw updErr

      setAvatarUrl(newAvatarUrl)
      setPendingFile(null)
      setPreviewUrl(null)
      setProfileMsg('Cambios guardados ✓')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setSavingProfile(false)
    }
  }

  async function changePassword() {
    if (pwd.length < 6) return
    setSavingPwd(true)
    setPwdMsg(null)
    const { error } = await supabase.auth.updateUser({ password: pwd })
    setSavingPwd(false)
    if (error) return setPwdMsg(error.message)
    setPwd('')
    setPwdMsg('Contraseña actualizada ✓')
  }

  if (loading) return <Spinner />

  const shown = previewUrl ?? avatarUrl
  const dirty = pendingFile != null

  return (
    <div className="mx-auto min-h-full max-w-md px-5 py-6">
      <div className="mb-6 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="text-sm text-slate-500 dark:text-slate-400">
          ‹ Volver
        </button>
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">Perfil</h1>
        <button onClick={signOut} className="text-sm text-slate-500 underline dark:text-slate-400">
          Salir
        </button>
      </div>

      {/* Foto */}
      <div className="card mb-4 flex flex-col items-center">
        <Avatar url={shown} name={name} size={112} />
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickFile} />
        <button
          onClick={() => fileRef.current?.click()}
          className="mt-3 text-sm font-medium text-brand"
        >
          {shown ? 'Cambiar imagen' : 'Añadir imagen'}
        </button>
      </div>

      {/* Apodo */}
      <div className="card mb-4 space-y-2">
        <label className="label">Apodo</label>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tu apodo"
        />
        {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
        {profileMsg && <p className="text-sm text-brand">{profileMsg}</p>}
        <button
          className="btn-primary w-full"
          disabled={savingProfile || (!dirty && name.trim() === '')}
          onClick={saveProfile}
        >
          {savingProfile ? '...' : 'Guardar cambios'}
        </button>
      </div>

      {/* Administración (solo si eres creador de alguna liga) */}
      {isAdmin && (
        <button
          onClick={() => navigate('/admin')}
          className="card mb-4 flex w-full items-center justify-between text-left transition active:scale-[0.99]"
        >
          <span className="flex items-center gap-3">
            <span className="text-xl">🛠️</span>
            <span>
              <span className="block font-semibold text-slate-900 dark:text-white">Administración</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                Liquidar apuestas de tus ligas
              </span>
            </span>
          </span>
          <span className="text-slate-400">›</span>
        </button>
      )}

      {/* Tema */}
      <div className="card mb-4">
        <label className="label">Apariencia</label>
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-700 dark:text-slate-300">
            Modo {theme === 'dark' ? 'oscuro' : 'claro'}
          </span>
          <button
            role="switch"
            aria-checked={theme === 'dark'}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={`relative h-7 w-12 rounded-full transition ${
              theme === 'dark' ? 'bg-brand' : 'bg-slate-300'
            }`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
                theme === 'dark' ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Contraseña */}
      <div className="card space-y-2">
        <label className="label">Cambiar contraseña</label>
        <PasswordInput
          minLength={6}
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          placeholder="Nueva contraseña"
          autoComplete="new-password"
        />
        {pwdMsg && <p className="text-sm text-brand">{pwdMsg}</p>}
        <button className="btn-ghost w-full" disabled={savingPwd || pwd.length < 6} onClick={changePassword}>
          {savingPwd ? '...' : 'Actualizar contraseña'}
        </button>
      </div>
    </div>
  )
}
