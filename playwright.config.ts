import { defineConfig, devices } from '@playwright/test'

// Tests e2e de humo. Levantan el dev server de Vite y prueban contra el Supabase
// real (usa el .env del proyecto). El flujo autenticado solo se ejecuta si se
// definen E2E_EMAIL / E2E_PASSWORD (si no, ese test se omite).
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    // Móvil, que es el uso real de la PWA.
    { name: 'mobile-chromium', use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
