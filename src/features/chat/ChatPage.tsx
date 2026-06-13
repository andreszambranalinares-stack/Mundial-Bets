import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useLeague } from '../leagues/LeagueLayout'
import { fmtTime } from '../../lib/format'
import type { LeagueMessage, Profile } from '../../lib/database.types'
import Avatar from '../../components/Avatar'
import Spinner from '../../components/Spinner'

type Prof = Pick<Profile, 'id' | 'display_name' | 'avatar_url'>

// Detecta si estamos en mobile (<768px) para ajustar el layout fijo del chat
function useIsMobile() {
  const [v, setV] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const fn = () => setV(window.innerWidth < 768)
    window.addEventListener('resize', fn, { passive: true })
    return () => window.removeEventListener('resize', fn)
  }, [])
  return v
}

export default function ChatPage() {
  const { league, userId } = useLeague()
  const isMobile = useIsMobile()
  const [messages, setMessages] = useState<LeagueMessage[]>([])
  const [profiles, setProfiles] = useState<Map<string, Prof>>(new Map())
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  const loadProfiles = useCallback(async () => {
    const { data: members } = await supabase
      .from('league_members')
      .select('user_id')
      .eq('league_id', league.id)
    const ids = (members ?? []).map((m) => m.user_id)
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', ids)
    setProfiles(new Map((profs ?? []).map((p) => [p.id, p as Prof])))
  }, [league.id])

  useEffect(() => {
    async function load() {
      await loadProfiles()
      const { data } = await supabase
        .from('league_messages')
        .select('*')
        .eq('league_id', league.id)
        .order('created_at', { ascending: true })
        .limit(200)
      setMessages((data ?? []) as LeagueMessage[])
      setLoading(false)
    }
    load()
  }, [league.id, loadProfiles])

  useEffect(() => {
    const channel = supabase
      .channel(`chat-${league.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'league_messages', filter: `league_id=eq.${league.id}` },
        (payload) => {
          const msg = payload.new as LeagueMessage
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
          setProfiles((prev) => {
            if (!prev.has(msg.user_id)) loadProfiles()
            return prev
          })
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [league.id, loadProfiles])

  // Scroll al fondo al cargar o recibir mensajes
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [messages, loading])

  async function send() {
    const content = text.trim()
    if (!content || sending) return
    setSending(true)
    const { error } = await supabase
      .from('league_messages')
      .insert({ league_id: league.id, user_id: userId, content })
    setSending(false)
    if (!error) setText('')
  }

  // Layout fijo que llena el espacio entre la cabecera y la nav inferior
  // isMobile: top=52px (cabecera), bottom=52px+safe-area (nav)
  // desktop: inset-0 con left=256px (sidebar)
  const containerStyle = isMobile
    ? { top: 52, bottom: 'calc(52px + env(safe-area-inset-bottom, 0px))' }
    : { top: 0, bottom: 0 }

  if (loading) {
    return (
      <div
        className="fixed inset-x-0 flex items-center justify-center bg-white dark:bg-slate-900 md:left-64"
        style={containerStyle}
      >
        <Spinner />
      </div>
    )
  }

  return (
    <div
      className="fixed inset-x-0 flex flex-col overflow-hidden bg-white dark:bg-slate-900 md:left-64"
      style={containerStyle}
    >
      {/* Área de mensajes — scroll interno */}
      <div ref={scrollAreaRef} className="flex-1 overflow-y-auto px-4 pt-4">
        {messages.length === 0 ? (
          <div className="card text-center text-sm text-slate-500 dark:text-slate-400">
            Aún no hay mensajes. ¡Rompe el hielo!
          </div>
        ) : (
          <div className="flex flex-col gap-3 pb-3">
            {messages.map((m) => {
              const mine = m.user_id === userId
              const p = profiles.get(m.user_id)
              return (
                <div key={m.id} className={`flex items-end gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
                  {!mine && <Avatar url={p?.avatar_url} name={p?.display_name} size={32} />}
                  <div className={`flex max-w-[78%] flex-col ${mine ? 'items-end' : 'items-start'}`}>
                    {!mine && (
                      <div className="mb-0.5 ml-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                        {p?.display_name ?? '—'}
                      </div>
                    )}
                    <div
                      className={`whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${
                        mine
                          ? 'rounded-br-md bg-brand text-slate-900'
                          : 'rounded-bl-md bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                      }`}
                    >
                      {m.content}
                    </div>
                    <div className={`mt-0.5 text-[10px] text-slate-400 ${mine ? 'mr-1' : 'ml-1'}`}>
                      {fmtTime(m.created_at)}
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Barra de envío — anclada al fondo del contenedor fijo */}
      <div className="border-t border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
          <input
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none dark:text-white dark:placeholder-slate-500"
            placeholder="Escribe un mensaje…"
            value={text}
            maxLength={1000}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
          />
          <button
            className="btn-primary shrink-0 rounded-xl px-4 py-1.5 text-sm"
            disabled={sending || !text.trim()}
            onClick={send}
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  )
}
