import { describe, it, expect } from 'vitest'
import { fmtChips, fmtOdds, selectionText, legText, fmtTimeAgo } from './format'

describe('fmtChips', () => {
  // El separador de miles depende de los datos ICU del entorno (en el navegador
  // es "."), así que validamos solo los dígitos y que no haya decimales.
  it('conserva todos los dígitos sin parte decimal', () => {
    expect(fmtChips(1000).replace(/\D/g, '')).toBe('1000')
    expect(fmtChips(1234567).replace(/\D/g, '')).toBe('1234567')
    expect(fmtChips(1234567)).not.toContain(',')
  })
  it('redondea al entero más cercano', () => {
    expect(fmtChips(99.4)).toBe('99')
    expect(fmtChips(99.6)).toBe('100')
  })
})

describe('fmtOdds', () => {
  it('siempre muestra dos decimales', () => {
    expect(fmtOdds(2)).toBe('2.00')
    expect(fmtOdds(1.5)).toBe('1.50')
    expect(fmtOdds(3.456)).toBe('3.46')
  })
})

describe('selectionText', () => {
  it('traduce 1X2 a nombres de equipo y Empate', () => {
    expect(selectionText('h2h', 'home', 0, 'España', 'Brasil')).toBe('España')
    expect(selectionText('h2h', 'away', 0, 'España', 'Brasil')).toBe('Brasil')
    expect(selectionText('h2h', 'draw', 0, 'España', 'Brasil')).toBe('Empate')
  })
  it('describe over/under con el punto', () => {
    expect(selectionText('totals', 'over', 2.5, 'A', 'B')).toBe('Más de 2.5 goles')
    expect(selectionText('totals', 'under', 1.5, 'A', 'B')).toBe('Menos de 1.5 goles')
  })
})

describe('legText', () => {
  it('usa selectionText cuando no hay label (mercado estándar)', () => {
    expect(legText({ market: 'h2h', selection: 'home', point: 0 }, 'España', 'Brasil')).toBe('España')
  })
  it('sustituye Local/Visitante por los equipos en el label avanzado', () => {
    expect(legText({ market: 'clean_sheet', selection: 'home', point: 0, label: 'Portería a cero: Local' }, 'España', 'Brasil'))
      .toBe('Portería a cero: España')
  })
  it('antepone el nombre del jugador cuando existe', () => {
    expect(legText({ market: 'player_goal', selection: 'yes', point: 0, label: 'marcará gol', playerName: 'Lamine' }, 'España', 'Brasil'))
      .toBe('Lamine marcará gol')
  })
})

describe('fmtTimeAgo', () => {
  it('muestra "ahora" para menos de un minuto', () => {
    expect(fmtTimeAgo(new Date(Date.now() - 10_000).toISOString())).toBe('ahora')
  })
  it('muestra minutos y horas', () => {
    expect(fmtTimeAgo(new Date(Date.now() - 5 * 60_000).toISOString())).toBe('hace 5 min')
    expect(fmtTimeAgo(new Date(Date.now() - 2 * 3_600_000).toISOString())).toBe('hace 2 h')
  })
  it('muestra días', () => {
    expect(fmtTimeAgo(new Date(Date.now() - 3 * 86_400_000).toISOString())).toBe('hace 3 d')
  })
})
