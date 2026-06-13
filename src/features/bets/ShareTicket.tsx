import { forwardRef } from 'react'
import { toBlob } from 'html-to-image'
import { fmtChips, fmtOdds, legText } from '../../lib/format'
import type { BetRow } from './filters'

// Boleto pensado para exportar como imagen (estilos inline para que la captura
// salga igual en cualquier navegador/tema). Se renderiza fuera de pantalla.
export const ShareTicket = forwardRef<HTMLDivElement, { bet: BetRow }>(function ShareTicket({ bet }, ref) {
  const isCombo = bet.num_legs > 1
  const odds = bet.combined_odds ?? bet.odds_taken ?? 1
  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: -10000,
        top: 0,
        width: 380,
        boxSizing: 'border-box',
        padding: 24,
        background: 'linear-gradient(160deg, #0f172a 0%, #1e293b 100%)',
        color: '#f8fafc',
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        borderRadius: 24,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontWeight: 800, fontSize: 20, color: '#22c55e' }}>Fantasy Bet</span>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>{isCombo ? `Combinada · ${bet.num_legs}` : 'Apuesta simple'}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {bet.legs.map((l) => (
          <div key={l.id} style={{ borderLeft: '3px solid #22c55e', paddingLeft: 10 }}>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>
              {l.match ? `${l.match.home_team} vs ${l.match.away_team}` : l.match_id}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 600 }}>
              <span>
                {l.match
                  ? legText(
                      { market: l.market, selection: l.selection, point: l.point, label: l.label, playerName: l.player_name },
                      l.match.home_team,
                      l.match.away_team,
                    )
                  : l.label ?? `${l.selection} ${l.point}`}
              </span>
              <span style={{ color: '#22c55e', marginLeft: 8 }}>{fmtOdds(l.odds_taken)}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ borderTop: '1px solid #334155', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Row label="Cuota total" value={`@ ${fmtOdds(odds)}`} />
        <Row label="Apostado" value={`${fmtChips(bet.stake)} fichas`} />
        <Row
          label={bet.status === 'won' ? 'Ganado' : 'Posible premio'}
          value={`${fmtChips(bet.settled_payout ?? bet.potential_payout)} fichas`}
          highlight
        />
      </div>
    </div>
  )
})

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: highlight ? 16 : 13 }}>
      <span style={{ color: '#94a3b8' }}>{label}</span>
      <span style={{ fontWeight: highlight ? 800 : 600, color: highlight ? '#22c55e' : '#f8fafc' }}>{value}</span>
    </div>
  )
}

// Captura el nodo como PNG y lo comparte (Web Share con archivo) o lo descarga.
export async function shareTicket(node: HTMLElement): Promise<void> {
  const blob = await toBlob(node, { pixelRatio: 2, cacheBust: true })
  if (!blob) return
  const file = new File([blob], 'boleto-fantasy-bet.png', { type: 'image/png' })

  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean }
  if (nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Mi boleto · Fantasy Bet' })
      return
    } catch {
      // El usuario canceló el diálogo de compartir: no hacemos nada.
      return
    }
  }

  // Fallback: descarga el PNG.
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  URL.revokeObjectURL(url)
}
