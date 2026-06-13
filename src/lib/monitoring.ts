// Monitorización de errores con Sentry. Solo se activa en producción y si hay DSN
// configurado (VITE_SENTRY_DSN), así en desarrollo no envía nada.
import * as Sentry from '@sentry/react'

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined

export function initMonitoring(): void {
  if (!dsn || !import.meta.env.PROD) return
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // Muestreo conservador de trazas; ajustar si se quiere más detalle.
    tracesSampleRate: 0.1,
  })
}

// Captura un error de una operación crítica (RPC de fichas) sin alterar el flujo.
// `where` da contexto (p.ej. 'place_combo_bet'); es un no-op si Sentry no está activo.
export function captureError(error: unknown, where: string): void {
  if (!dsn || !import.meta.env.PROD) return
  Sentry.captureException(error, { tags: { op: where } })
}

export const ErrorBoundary = Sentry.ErrorBoundary
