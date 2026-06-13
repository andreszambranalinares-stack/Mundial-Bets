// Logo de marca de Fantasy Bet. El archivo vive en /public/logo.png.
// `size` controla el alto en píxeles (mantiene proporción, sin distorsionar).
export default function Logo({
  size = 96,
  className = '',
  alt = 'Fantasy Bet',
}: {
  size?: number
  className?: string
  alt?: string
}) {
  return (
    <img
      src="/logo.png"
      alt={alt}
      height={size}
      style={{ height: size }}
      className={`w-auto select-none object-contain ${className}`}
      draggable={false}
    />
  )
}
