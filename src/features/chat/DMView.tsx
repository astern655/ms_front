import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useT } from '../../lib/i18n'
import { dmKeyFor, listDM, sendDM, deleteMessage, type Message } from './messages'

export function DMView({
  groupId,
  meId,
  meName,
  peerId,
  peerName,
}: {
  groupId: string
  meId: string
  meName: string
  peerId: string
  peerName: string
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const dmKey = dmKeyFor(meId, peerId)
  const t = useT()

  const scroll = () =>
    requestAnimationFrame(() => listRef.current?.scrollTo({ top: 1e9, behavior: 'smooth' }))

  useEffect(() => {
    let alive = true
    listDM(dmKey)
      .then((ms) => {
        if (!alive) return
        setMessages(ms)
        scroll()
      })
      .catch((e) => setError((e as Error).message))

    const ch = supabase
      .channel(`dm:${dmKey}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `dm_key=eq.${dmKey}` },
        (p) => {
          setMessages((prev) =>
            prev.some((m) => m.id === (p.new as Message).id) ? prev : [...prev, p.new as Message],
          )
          scroll()
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages' },
        (p) => setMessages((prev) => prev.filter((m) => m.id !== (p.old as { id: string }).id)),
      )
      .subscribe()

    return () => {
      alive = false
      supabase.removeChannel(ch)
    }
  }, [dmKey])

  const send = async () => {
    const content = text.trim()
    if (!content) return
    setText('')
    try {
      await sendDM({ groupId, dmKey, userId: meId, name: meName, content })
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="team-chat">
      <div className="chat-topbar">
        <span className="chat-title">
          <span className="avatar sm">{(peerName || '?').slice(0, 2)}</span>
          {peerName}
        </span>
        <span className="dm-badge">{t('다이렉트 메시지', 'Direct message')}</span>
      </div>

      <div className="chat-msgs" ref={listRef}>
        {messages.length === 0 && (
          <p className="ai-empty">{t(`${peerName}님과의 대화를 시작하세요.`, `Start a conversation with ${peerName}.`)}</p>
        )}
        {messages.map((m) => {
          const mine = m.user_id === meId
          return (
            <div key={m.id} className="chat-msg">
              <div className="chat-msg-head">
                <span className="chat-author">{m.author_name}</span>
                <span className="chat-time">
                  {new Date(m.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                </span>
                {mine && (
                  <div className="chat-msg-actions">
                    <button onClick={() => deleteMessage(m.id).catch(() => {})} title={t('삭제', 'Delete')}>
                      ✕
                    </button>
                  </div>
                )}
              </div>
              <div className="chat-body">{m.content}</div>
            </div>
          )
        })}
      </div>

      <div className="chat-input chat-compose">
        <input
          className="field"
          placeholder={t(`${peerName}님에게 메시지`, `Message ${peerName}`)}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
        />
        <button className="ai-send" onClick={send}>
          {t('보내기', 'Send')}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  )
}
