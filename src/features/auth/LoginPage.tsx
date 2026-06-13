import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import PasswordInput from '../../components/PasswordInput'
import Logo from '../../components/Logo'

export default function LoginPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setBusy(true)
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name || email.split('@')[0] } },
        })
        if (error) throw error
        setInfo('Cuenta creada. Si no entras directamente, revisa tu email.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de autenticación')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-sm flex-col justify-center px-5 py-10">
      <div className="mb-8 flex flex-col items-center text-center">
        <Logo size={140} />
        <p className="mt-3 text-sm text-slate-400">Bienvenido a la ludopatía crónica</p>
      </div>

      <form onSubmit={onSubmit} className="card space-y-3">
        {mode === 'signup' && (
          <div>
            <label className="label">Nombre</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre"
              autoComplete="name"
            />
          </div>
        )}
        <div>
          <label className="label">Email</label>
          <input
            className="input"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tucorreo@email.com"
            autoComplete="email"
          />
        </div>
        <div>
          <label className="label">Contraseña</label>
          <PasswordInput
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {info && <p className="text-sm text-brand">{info}</p>}

        <button className="btn-primary w-full" disabled={busy}>
          {busy ? '...' : mode === 'signin' ? 'Entrar' : 'Crear cuenta'}
        </button>
      </form>

      <button
        className="mt-4 text-center text-sm text-slate-400 underline"
        onClick={() => {
          setMode(mode === 'signin' ? 'signup' : 'signin')
          setError(null)
          setInfo(null)
        }}
      >
        {mode === 'signin' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Entra'}
      </button>
    </div>
  )
}
