// Genera los iconos PWA optimizados y comprime el logo a partir de public/logo.png.
// Uso: node scripts/gen-icons.mjs
// Requiere la devDependency `sharp`.
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { statSync } from 'node:fs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pub = join(root, 'public')
const SRC = join(pub, 'logo.png')
const THEME_BG = '#0f172a' // mismo color que el manifest

const kb = (p) => (statSync(p).size / 1024).toFixed(1) + ' KB'

// Buffer del original ANTES de sobrescribir logo.png (la fuente puede ser grande).
const source = await sharp(SRC).toBuffer()
const png = () => sharp(source).clone()

// Icono "any" 512 y 192: el logo centrado sobre fondo transparente.
async function contain(size, out) {
  await png()
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, palette: true })
    .toFile(join(pub, out))
  console.log(out, '→', kb(join(pub, out)))
}

// Icono maskable 512: con margen seguro (~10%) sobre fondo del tema (full-bleed).
async function maskable(out) {
  const safe = Math.round(512 * 0.8)
  const logo = await png()
    .resize(safe, safe, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer()
  await sharp({ create: { width: 512, height: 512, channels: 4, background: THEME_BG } })
    .composite([{ input: logo, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(join(pub, out))
  console.log(out, '→', kb(join(pub, out)))
}

await contain(512, 'pwa-512.png')
await contain(192, 'pwa-192.png')
await maskable('maskable-512.png')

// Logo ligero para el componente <Logo> (sobrescribe el grande, máx. 512px).
await png()
  .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
  .png({ compressionLevel: 9, palette: true })
  .toFile(join(pub, 'logo.optimized.png'))
// Reemplaza logo.png por la versión optimizada.
const { renameSync } = await import('node:fs')
renameSync(join(pub, 'logo.optimized.png'), SRC)
console.log('logo.png →', kb(SRC))
