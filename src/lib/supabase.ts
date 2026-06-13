import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Mensaje claro en consola si faltan las variables de entorno
  console.error(
    'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Copia .env.example a .env y rellénalas.',
  )
}

// Valores de reserva para que la app cargue aunque falte el .env (mostrará
// errores de auth al intentar entrar, pero no se cae al arrancar).
export const supabase = createClient<Database>(
  url || 'http://localhost:54321',
  anonKey || 'public-anon-key-placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  },
)
