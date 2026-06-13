import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './features/auth/AuthProvider'
import { ThemeProvider } from './lib/theme'
import { initMonitoring, ErrorBoundary } from './lib/monitoring'
import './index.css'

initMonitoring()

function Fallback() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="card max-w-sm">
        <div className="text-4xl">😵</div>
        <h1 className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">Algo ha fallado</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Ha ocurrido un error inesperado. Vuelve a cargar la app.
        </p>
        <button className="btn-primary mt-4 w-full" onClick={() => window.location.reload()}>
          Recargar
        </button>
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary fallback={<Fallback />}>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
)
