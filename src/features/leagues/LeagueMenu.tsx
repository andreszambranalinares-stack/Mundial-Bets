import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { League } from '../../lib/database.types'
import { fileToSquareDataUrl } from '../../lib/image'
import ConfirmModal from '../../components/ConfirmModal'

type Modal = null | 'leave' | 'delete'

export default function LeagueMenu({
  league,
  isOwner,
  onChanged,
}: {
  league: League
  isOwner: boolean
  onChanged: (l: League) => void
}) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [modal, setModal] = useState<Modal>(null)
  const [busyImg, setBusyImg] = useState(false)
  const [shared, setShared] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Cerrar al hacer clic fuera
  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const inviteUrl = `${window.location.origin}/unirse/${league.invite_code}`

  async function share() {
    setOpen(false)
    const data = {
      title: `Únete a ${league.name}`,
      text: `Te invito a mi liga "${league.name}" en Fantasy Bet`,
      url: inviteUrl,
    }
    if (navigator.share) {
      try {
        await navigator.share(data)
      } catch {
        /* el usuario canceló */
      }
    } else {
      await navigator.clipboard?.writeText(inviteUrl)
      setShared(true)
      setTimeout(() => setShared(false), 1500)
    }
  }

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (e.target) e.target.value = '' // permite volver a elegir el mismo archivo
    if (!file) return
    if (!file.type.startsWith('image/')) {
      alert('Selecciona un archivo de imagen.')
      return
    }
    setOpen(false)
    setBusyImg(true)
    try {
      // Redimensionamos/comprimimos en el navegador y guardamos la imagen como
      // data URL directamente en la liga: así no depende de la configuración
      // del bucket de Storage (causa habitual de "no funciona").
      const dataUrl = await fileToSquareDataUrl(file, { maxSize: 256, quality: 0.82 })
      const { data, error } = await supabase.rpc('set_league_image', {
        p_league_id: league.id,
        p_image_url: dataUrl,
      })
      if (error) throw error
      onChanged(data as League)
    } catch (err) {
      const msg = err instanceof Error
        ? err.message
        : typeof err === 'object' && err !== null && 'message' in err
        ? String((err as Record<string, unknown>).message)
        : JSON.stringify(err)
      console.error('Error imagen liga:', err)
      alert('Error al cambiar la imagen:\n' + msg)
    } finally {
      setBusyImg(false)
    }
  }

  async function toggleInvite() {
    setOpen(false)
    const { data, error } = await supabase.rpc('set_invite_active', {
      p_league_id: league.id,
      p_active: !league.invite_active,
    })
    if (!error && data) onChanged(data as League)
  }

  async function doLeave() {
    const { error } = await supabase.rpc('leave_league', { p_league_id: league.id })
    if (error) throw new Error(error.message)
    navigate('/leagues', { replace: true })
  }

  async function doDelete() {
    const { error } = await supabase.rpc('delete_league', { p_league_id: league.id })
    if (error) throw new Error(error.message)
    navigate('/leagues', { replace: true })
  }

  return (
    <div className="relative" ref={wrapRef}>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickImage} />
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 w-8 items-center justify-center rounded-full text-xl leading-none text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800"
        aria-label="Opciones de la liga"
        disabled={busyImg}
      >
        {busyImg ? '…' : '⋮'}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-1 w-60 max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
          <Item onClick={share}>🔗 Compartir invitación</Item>
          {isOwner && (
            <>
              <Item onClick={() => fileRef.current?.click()}>🖼️ Editar imagen de liga</Item>
              <Item onClick={toggleInvite}>
                {league.invite_active ? '🚫 Desactivar enlace de invitación' : '✅ Activar enlace de invitación'}
              </Item>
            </>
          )}
          <Item onClick={() => { setOpen(false); setModal('leave') }}>🚪 Abandonar liga</Item>
          {isOwner && (
            <Item danger onClick={() => { setOpen(false); setModal('delete') }}>
              🗑️ Eliminar liga
            </Item>
          )}
        </div>
      )}

      {shared && (
        <span className="absolute right-0 top-9 z-30 whitespace-nowrap rounded-md bg-brand px-2 py-1 text-xs font-semibold text-slate-900">
          ¡Enlace copiado!
        </span>
      )}

      {modal === 'leave' && (
        <ConfirmModal
          title="Abandonar liga"
          message={
            isOwner
              ? '¿Seguro que quieres abandonar la liga? Si quedan más miembros, la propiedad pasará al más antiguo; si eres el único, se eliminará.'
              : '¿Seguro que quieres abandonar la liga?'
          }
          danger
          onConfirm={doLeave}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'delete' && (
        <ConfirmModal
          title="Eliminar liga"
          message="¿Seguro que quieres eliminar la liga? Se borrará para todos los miembros y no se puede deshacer."
          confirmLabel="Sí, eliminar"
          danger
          onConfirm={doDelete}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

function Item({
  children,
  onClick,
  danger = false,
}: {
  children: React.ReactNode
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`block w-full px-4 py-2.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 ${
        danger ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'
      }`}
    >
      {children}
    </button>
  )
}
