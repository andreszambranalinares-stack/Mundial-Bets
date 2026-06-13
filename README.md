# ⚽️ Mundial Bets

App de **apuestas ficticias** (fichas virtuales, sin dinero real) para el Mundial de fútbol,
pensada para jugar con amigos en una **liga compartida**. Cada jugador empieza con 1000 fichas,
apuesta a partidos con **cuotas reales** y la app **liquida sola** según el resultado.

- 📱 **PWA**: se abre desde el navegador del móvil y se instala como app (iPhone + Android).
- 🔄 **Tiempo real**: el ranking y los saldos se actualizan en vivo en todos los móviles.
- 🔒 **Anti-trampas**: saldos y apuestas se gestionan en el servidor (funciones atómicas + RLS).
- 🏟️ **Datos reales**: partidos, cuotas y resultados desde [The Odds API](https://the-odds-api.com).

> ⚠️ App de entretenimiento entre amigos. No se juega con dinero real.

## Stack

- **Frontend:** Vite + React + TypeScript + Tailwind + `vite-plugin-pwa`.
- **Backend:** [Supabase](https://supabase.com) (Auth + Postgres + RLS + Realtime + Edge Functions).
- **Cuotas/resultados:** The Odds API (`sport_key = soccer_fifa_world_cup`).

## Estructura

```
src/                    Frontend (React)
  features/auth         Login / sesión
  features/leagues      Crear / unirse a ligas, layout + saldo en vivo
  features/matches      Lista de partidos + modal de apuesta
  features/bets         "Mis apuestas"
  features/leaderboard  Ranking en vivo
  lib/                  Cliente Supabase, tipos, formato
supabase/
  migrations/           Esquema, RLS y funciones (place_bet, settle_match)
  functions/            Edge functions: sync-matches, settle-results
  seed.sql              Partidos de prueba para desarrollo local
  cron.example.sql      Programación de tareas (rellenar y ejecutar en Supabase)
```

## Puesta en marcha

### 1. Frontend (local)

```bash
npm install
cp .env.example .env     # rellena VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm run dev              # http://localhost:5173
```

### 2. Backend en Supabase Cloud (recomendado para jugar entre móviles)

1. Crea un proyecto en [supabase.com](https://supabase.com) y copia `URL` y `anon key`
   (Project Settings → API) al `.env`.
2. Aplica el esquema: pega el contenido de `supabase/migrations/0001_init.sql` y
   `0002_realtime.sql` en el **SQL Editor** del dashboard (o usa la CLI, ver abajo).
3. Consigue una API key gratis en [the-odds-api.com](https://the-odds-api.com) y guárdala
   como secret (no va en el frontend):
   ```bash
   npx supabase secrets set ODDS_API_KEY=tu_api_key
   ```
4. Despliega las edge functions:
   ```bash
   npx supabase functions deploy sync-matches
   npx supabase functions deploy settle-results
   ```
5. Programa el cron: abre `supabase/cron.example.sql`, rellena `<PROJECT_REF>` y
   `<SERVICE_ROLE_KEY>` y ejecútalo en el SQL Editor.
6. Lanza una primera sincronización a mano para llenar partidos y cuotas:
   ```bash
   curl -X POST https://<PROJECT_REF>.supabase.co/functions/v1/sync-matches \
     -H "Authorization: Bearer <SERVICE_ROLE_KEY>"
   ```

### Alternativa: stack 100% local con la CLI

```bash
npx supabase start                 # levanta Postgres + Auth + Studio en Docker
npx supabase db reset              # aplica migrations + seed.sql
# Las URLs/keys locales salen por consola -> ponlas en .env
```

## Cómo se juega

1. Te registras (email + contraseña).
2. **Creas una liga** (te da un código) o **te unes con el código** de tu amigo.
3. Entras a la liga con tus **1000 fichas** y apuestas en la pestaña **Partidos**
   (1X2 y más/menos goles). La cuota se bloquea al apostar.
4. Cuando el partido acaba, la app liquida sola: los ganadores cobran `apuesta × cuota`.
5. La pestaña **Ranking** muestra la clasificación por fichas, en vivo.

## Tests

```bash
npm run test:run     # unitarios (Vitest): formato, filtros de apuestas, cálculo de combinada
npm run e2e          # e2e de humo (Playwright): carga el login sin errores de consola
                     #   flujo autenticado opcional: E2E_EMAIL / E2E_PASSWORD
supabase test db     # pgTAP: invariantes de dinero (place_combo_bet / settle_match)
npm run gen-icons    # regenera los iconos PWA optimizados desde public/logo.png
```

## Verificación end-to-end

- **Apostar:** con el seed de prueba, crea liga, apuesta y comprueba que el saldo baja.
- **Liquidar:** simula un resultado y la liquidación:
  ```sql
  update public.matches set home_score = 2, away_score = 1 where id = 'demo-esp-bra';
  select public.settle_match('demo-esp-bra');
  -- comprueba bets.status y league_members.balance
  ```
- **Realtime:** abre la app en dos navegadores/móviles en la misma liga; al liquidar,
  el ranking se actualiza solo en ambos.
- **Cuadre contable:** la suma de `transactions.amount` por miembro = su `balance`.

## Fase 2 (futuro)

Apuestas a jugadores (goleador, etc.). El modelo de datos ya está preparado para añadir
nuevos mercados sin tocar la economía de fichas.
