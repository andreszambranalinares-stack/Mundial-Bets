// Avatar circular reutilizable (perfil, ranking, chat...).
// Si no hay imagen, muestra la inicial del nombre sobre un fondo de marca.
export default function Avatar({
  url,
  name,
  size = 40,
  className = '',
}: {
  url?: string | null
  name?: string | null
  size?: number
  className?: string
}) {
  const initial = (name?.trim()?.[0] ?? '?').toUpperCase()
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) }

  if (url) {
    return (
      <img
        src={url}
        alt={name ?? 'avatar'}
        style={style}
        className={`shrink-0 rounded-full object-cover ${className}`}
        draggable={false}
      />
    )
  }

  return (
    <div
      style={style}
      className={`flex shrink-0 items-center justify-center rounded-full bg-brand/20 font-bold text-brand ${className}`}
      aria-hidden
    >
      {initial}
    </div>
  )
}
