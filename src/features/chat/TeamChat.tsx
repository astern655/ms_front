import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { getGroupMembers, type Member } from '../groups/teams'
import {
  listMessages,
  listReactions,
  sendMessage,
  deleteMessage,
  setPinned,
  toggleReaction,
  notifyMentions,
  uploadChatImage,
  type Message,
  type Reaction,
} from './messages'

const IMG_RE = /^https?:\/\/\S+\.(png|jpe?g|gif|webp)(\?\S*)?$/i

const EMOJIS = ['👍', '❤️', '😂', '🎉', '👀']

export function TeamChat({
  groupId,
  teamId,
  teamName,
  userId,
  userName,
  onEnterMeeting,
}: {
  groupId: string
  teamId: string
  teamName: string
  userId: string
  userName: string
  onEnterMeeting: () => void
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [reactions, setReactions] = useState<Reaction[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const scroll = () =>
    requestAnimationFrame(() => listRef.current?.scrollTo({ top: 1e9, behavior: 'smooth' }))

  const refetchReactions = (msgs: Message[]) =>
    listReactions(msgs.map((m) => m.id))
      .then(setReactions)
      .catch(() => {})

  // Initial load + realtime subscription per team channel.
  useEffect(() => {
    let alive = true
    getGroupMembers(groupId).then((m) => alive && setMembers(m)).catch(() => {})
    listMessages(teamId)
      .then((ms) => {
        if (!alive) return
        setMessages(ms)
        refetchReactions(ms)
        scroll()
      })
      .catch((e) => setError((e as Error).message))

    const ch = supabase
      .channel(`chat:${teamId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `team_id=eq.${teamId}` },
        (p) => {
          setMessages((prev) =>
            prev.some((m) => m.id === (p.new as Message).id) ? prev : [...prev, p.new as Message],
          )
          scroll()
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `team_id=eq.${teamId}` },
        (p) => setMessages((prev) => prev.map((m) => (m.id === (p.new as Message).id ? (p.new as Message) : m))),
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (p) =>
        setMessages((prev) => prev.filter((m) => m.id !== (p.old as { id: string }).id)),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, () =>
        setMessages((prev) => {
          refetchReactions(prev)
          return prev
        }),
      )
      .subscribe()

    return () => {
      alive = false
      supabase.removeChannel(ch)
    }
  }, [groupId, teamId])

  const send = async () => {
    const content = text.trim()
    if (!content) return
    setText('')
    // Resolve @mentions to member ids.
    const mentioned = members.filter((mem) => content.includes(`@${mem.name}`))
    try {
      await sendMessage({
        groupId,
        teamId,
        userId,
        name: userName,
        content,
        mentions: mentioned.map((m) => m.user_id),
      })
      if (mentioned.length) notifyMentions(mentioned.map((m) => m.user_id), userName, content).catch(() => {})
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const attachImage = async (file: File) => {
    setUploading(true)
    try {
      const url = await uploadChatImage(teamId, file)
      await sendMessage({ groupId, teamId, userId, name: userName, content: url })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  const react = (msg: Message, emoji: string) => {
    const has = reactions.some(
      (r) => r.message_id === msg.id && r.user_id === userId && r.emoji === emoji,
    )
    toggleReaction(msg.id, userId, emoji, has).catch((e) => setError((e as Error).message))
  }

  const pinned = messages.filter((m) => m.pinned)
  const reactionsByMsg = useMemo(() => {
    const map: Record<string, Record<string, { count: number; mine: boolean }>> = {}
    for (const r of reactions) {
      const m = (map[r.message_id] ??= {})
      const e = (m[r.emoji] ??= { count: 0, mine: false })
      e.count += 1
      if (r.user_id === userId) e.mine = true
    }
    return map
  }, [reactions, userId])

  const renderContent = (content: string) =>
    content.split(/(@[^\s@]+)/g).map((part, i) =>
      part.startsWith('@') && members.some((m) => `@${m.name}` === part) ? (
        <span key={i} className="mention">
          {part}
        </span>
      ) : (
        <span key={i}>{part}</span>
      ),
    )

  return (
    <div className="team-chat">
      <div className="chat-topbar">
        <span className="chat-title">
          <span className="hash">#</span>
          {teamName}
        </span>
        <button className="btn-primary chat-join" onClick={onEnterMeeting}>
          회의 입장
        </button>
      </div>

      {pinned.length > 0 && (
        <div className="chat-pins">
          <span className="chat-pins-label">📌 고정 {pinned.length}</span>
          {pinned.map((m) => (
            <span key={m.id} className="chat-pin-item" title={m.content}>
              {m.author_name}: {m.content.slice(0, 40)}
            </span>
          ))}
        </div>
      )}

      <div className="chat-msgs" ref={listRef}>
        {messages.length === 0 && <p className="ai-empty">첫 메시지를 남겨보세요. @이름으로 멘션할 수 있어요.</p>}
        {messages.map((m) => {
          const mine = m.user_id === userId
          const rx = reactionsByMsg[m.id] ?? {}
          return (
            <div key={m.id} className="chat-msg">
              <div className="chat-msg-head">
                <span className="chat-author">{m.author_name}</span>
                <span className="chat-time">{new Date(m.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
                <div className="chat-msg-actions">
                  {EMOJIS.map((e) => (
                    <button key={e} onClick={() => react(m, e)} title="반응">
                      {e}
                    </button>
                  ))}
                  <button onClick={() => setPinned(m.id, !m.pinned).catch(() => {})} title="고정">
                    📌
                  </button>
                  {mine && (
                    <button onClick={() => deleteMessage(m.id).catch(() => {})} title="삭제">
                      ✕
                    </button>
                  )}
                </div>
              </div>
              <div className="chat-body">
                {IMG_RE.test(m.content.trim()) ? (
                  <a href={m.content.trim()} target="_blank" rel="noreferrer">
                    <img className="chat-image" src={m.content.trim()} alt="첨부 이미지" />
                  </a>
                ) : (
                  renderContent(m.content)
                )}
              </div>
              {Object.keys(rx).length > 0 && (
                <div className="chat-reactions">
                  {Object.entries(rx).map(([emoji, v]) => (
                    <button
                      key={emoji}
                      className={`chat-react ${v.mine ? 'mine' : ''}`}
                      onClick={() => react(m, emoji)}
                    >
                      {emoji} {v.count}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="chat-input chat-compose">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) attachImage(f)
            e.target.value = ''
          }}
        />
        <button
          className="chat-attach"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          title="이미지 첨부"
          aria-label="이미지 첨부"
        >
          {uploading ? '…' : '📎'}
        </button>
        <input
          className="field"
          placeholder={`#${teamName}에 메시지 (@이름 멘션)`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
        />
        <button className="ai-send" onClick={send}>
          보내기
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  )
}
