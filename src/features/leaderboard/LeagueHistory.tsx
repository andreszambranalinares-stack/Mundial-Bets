import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useLeague } from '../leagues/LeagueLayout'
import { fmtChips } from '../../lib/format'
import type { Profile } from '../../lib/database.types'
import Avatar from '../../components/Avatar'
import Spinner from '../../components/Spinner'

type Row = { jornada: number; jornada_date: string; user_id: string; balance: number }
type Prof = Pick<Profile, 'id' | 'display_name' | 'avatar_url'>

export default function LeagueHistory() {
  const { league } = useLeague()
  const [rows, setRows] = useState<Row[]>([])
  const [profiles, setProfiles] = useState<Map<string, Prof>>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.rpc('league_history', { p_league_id: league.id })
      const list = (data ?? []) as Row[]
      setRows(list)
      const ids = [...new Set(list.map((r) => r.user_id))]
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', ids)
        setProfiles(new Map((profs ?? []).map((p) => [p.id, p as Prof])))
      }
      setLoading(false)
    }
    load()
  }, [league.id])

  const { jornadas, users, balanceOf, leaderByJornada } = useMemo(() => {
    const jMap = new Map<number, string>()
    const balanceOf = new Map<string, number>() // `${user}|${jornada}`
    const leaderByJornada = new Map<number, { user: string; balance: number }>()
    for (const r of rows) {
      jMap.set(r.jornada, r.jornada_date)
      balanceOf.set(`${r.user_id}|${r.jornada}`, r.balance)
      const cur = leaderByJornada.get(r.jornada)
      if (!cur || r.balance > cur.balance) leaderByJornada.set(r.jornada, { user: r.user_id, balance: r.balance })
    }
    const jornadas = [...jMap.entries()].sort((a, b) => a[0] - b[0]).map(([n, d]) => ({ n, d }))
    // Usuarios ordenados por el saldo de la última jornada
    const last = jornadas[jornadas.length - 1]?.n
    const users = [...new Set(rows.map((r) => r.user_id))].sort(
      (a, b) => (balanceOf.get(`${b}|${last}`) ?? 0) - (balanceOf.get(`${a}|${last}`) ?? 0),
    )
    return { jornadas, users, balanceOf, leaderByJornada }
  }, [rows])

  if (loading) return <Spinner />
  if (jornadas.length === 0)
    return (
      <div className="card text-center text-sm text-slate-500 dark:text-slate-400">
        Aún no hay jornadas con apuestas liquidadas. El historial aparecerá cuando se jueguen partidos
        sobre los que hayáis apostado.
      </div>
    )

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-slate-100 px-3 py-2 text-left text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              Jugador
            </th>
            {jornadas.map((j) => (
              <th key={j.n} className="px-3 py-2 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">
                <div>J{j.n}</div>
                <div className="font-normal text-slate-400">
                  {new Date(j.d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const p = profiles.get(u)
            return (
              <tr key={u} className="border-t border-slate-200 dark:border-slate-800">
                <td className="sticky left-0 z-10 bg-white px-3 py-2 dark:bg-slate-900">
                  <div className="flex items-center gap-2">
                    <Avatar url={p?.avatar_url} name={p?.display_name} size={26} />
                    <span className="max-w-[90px] truncate font-medium text-slate-900 dark:text-white">
                      {p?.display_name ?? '—'}
                    </span>
                  </div>
                </td>
                {jornadas.map((j) => {
                  const bal = balanceOf.get(`${u}|${j.n}`)
                  const isLeader = leaderByJornada.get(j.n)?.user === u
                  return (
                    <td
                      key={j.n}
                      className={`px-3 py-2 text-center tabular-nums ${
                        isLeader
                          ? 'font-bold text-brand'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {isLeader && <span className="mr-0.5">👑</span>}
                      {bal != null ? fmtChips(bal) : '—'}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
