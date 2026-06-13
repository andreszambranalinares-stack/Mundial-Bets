import { useState, type ReactNode } from 'react'

// Modal de confirmación Sí/No reutilizable (abandonar/eliminar liga, etc.).
export default function ConfirmModal({
  title,
  message,
  confirmLabel = 'Sí',
  cancelLabel = 'No',
  danger = false,
  onConfirm,
  onClose,
}: {
  title: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => Promise<void> | void
  onClose: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo salió mal')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-1 text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
        <div className="mb-4 text-sm text-slate-600 dark:text-slate-400">{message}</div>

        {error && <p className="mb-3 text-sm text-red-500 dark:text-red-400">{error}</p>}

        <div className="flex gap-2">
          <button className="btn-ghost flex-1" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            className={`btn flex-1 text-white ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-brand text-slate-900 hover:bg-brand-dark'}`}
            onClick={confirm}
            disabled={busy}
          >
            {busy ? '...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
