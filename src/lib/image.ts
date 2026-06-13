// Utilidades de imagen para subir avatares/imágenes de liga sin depender de
// Supabase Storage: la imagen se redimensiona y comprime en el navegador y se
// guarda como data URL (cabe de sobra en una columna `text`).

interface ResizeOpts {
  maxSize?: number // lado máximo en píxeles (se mantiene la proporción)
  quality?: number // 0..1 para JPEG/WebP
}

// Lee un File de imagen, lo recorta a un cuadrado centrado, lo redimensiona a
// `maxSize` y devuelve un data URL JPEG comprimido.
export async function fileToSquareDataUrl(
  file: File,
  { maxSize = 256, quality = 0.82 }: ResizeOpts = {},
): Promise<string> {
  const dataUrl = await readAsDataUrl(file)
  const img = await loadImage(dataUrl)

  // Recorte cuadrado centrado.
  const side = Math.min(img.naturalWidth, img.naturalHeight)
  const sx = (img.naturalWidth - side) / 2
  const sy = (img.naturalHeight - side) / 2
  const target = Math.min(maxSize, side)

  const canvas = document.createElement('canvas')
  canvas.width = target
  canvas.height = target
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo procesar la imagen')
  ctx.drawImage(img, sx, sy, side, side, 0, 0, target, target)

  return canvas.toDataURL('image/jpeg', quality)
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Archivo de imagen no válido'))
    img.src = src
  })
}
