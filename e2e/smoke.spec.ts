import { test, expect } from '@playwright/test'

// Recoge errores de consola del navegador para fallar si algo peta al cargar.
function trackConsoleErrors(errors: string[]) {
  return (msg: { type: () => string; text: () => string }) => {
    if (msg.type() === 'error') errors.push(msg.text())
  }
}

test('la pantalla de login carga sin errores', async ({ page }) => {
  const errors: string[] = []
  page.on('console', trackConsoleErrors(errors))

  await page.goto('/')
  // El login muestra el lema de la app.
  await expect(page.getByText(/ludopat[ií]a cr[oó]nica/i)).toBeVisible()
  // Hay campos de email y contraseña.
  await expect(page.locator('input[type="email"]')).toBeVisible()
  await expect(page.locator('input[type="password"]')).toBeVisible()

  // No deben aparecer errores de consola del navegador (se ignora el aviso
  // esperado de variables de entorno si faltara el .env).
  const real = errors.filter((e) => !/VITE_SUPABASE/.test(e))
  expect(real, `Errores de consola:\n${real.join('\n')}`).toHaveLength(0)
})

// Flujo autenticado: solo si hay credenciales de prueba en el entorno.
const EMAIL = process.env.E2E_EMAIL
const PASSWORD = process.env.E2E_PASSWORD

test.describe('flujo autenticado (requiere E2E_EMAIL/E2E_PASSWORD)', () => {
  test.skip(!EMAIL || !PASSWORD, 'Define E2E_EMAIL y E2E_PASSWORD para ejecutar este test')

  test('login → entrar y navegar sin errores', async ({ page }) => {
    const errors: string[] = []
    page.on('console', trackConsoleErrors(errors))

    await page.goto('/')
    await page.locator('input[type="email"]').fill(EMAIL!)
    await page.locator('input[type="password"]').fill(PASSWORD!)
    await page.getByRole('button', { name: /entrar|iniciar/i }).click()

    // Tras autenticarse se llega a la lista de ligas (o al onboarding).
    await expect(page).toHaveURL(/\/(leagues|l\/)/, { timeout: 15_000 })

    const real = errors.filter((e) => !/VITE_SUPABASE/.test(e))
    expect(real, `Errores de consola:\n${real.join('\n')}`).toHaveLength(0)
  })
})
