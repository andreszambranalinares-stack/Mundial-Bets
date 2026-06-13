export default function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-slate-400">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-brand" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  )
}
