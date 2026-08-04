import { useEffect, useMemo, useRef, useState } from 'react'
import { useChat, useLocalParticipant } from '@livekit/components-react'
import { SendIcon } from './icons'
import type { TranscriptEntry } from '../lib/caption'

type FeedItem = {
  kind: 'chat' | 'caption'
  id: string
  ts: number
  mine: boolean
  from: string
  text: string
  sign?: boolean
}

// Dock body: typed chat + live captions (viewer's language), time-ordered.
export function ChatFeed({
  captions,
  displayLang,
  myName,
}: {
  captions: TranscriptEntry[]
  displayLang: string
  myName: string
}) {
  const { chatMessages, send, isSending } = useChat()
  const { localParticipant } = useLocalParticipant()
  const [text, setText] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  const feed = useMemo<FeedItem[]>(() => {
    const chats: FeedItem[] = chatMessages.map((m) => ({
      kind: 'chat',
      id: `c-${m.id ?? m.timestamp}`,
      ts: m.timestamp,
      mine: m.from?.identity === localParticipant.identity,
      from: m.from?.name || m.from?.identity || '익명',
      text: m.message,
    }))
    const caps: FeedItem[] = captions.map((e) => ({
      kind: 'caption',
      id: `t-${e.id}`,
      ts: e.ts,
      mine: e.speaker === myName,
      from: e.speaker,
      text: e.translations[displayLang] || e.sourceText,
      sign: e.kind === 'sign',
    }))
    return [...chats, ...caps].sort((a, b) => a.ts - b.ts)
  }, [chatMessages, captions, displayLang, myName, localParticipant.identity])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [feed.length])

  const submit = async () => {
    const t = text.trim()
    if (!t || isSending) return
    await send(t)
    setText('')
  }

  return (
    <div className="dock-fill">
      <div className="chat-list">
        {feed.length === 0 && (
          <p className="chat-empty">말하면 자막이, 입력하면 메시지가 여기에 기록됩니다.</p>
        )}
        {feed.map((it) => (
          <div
            key={it.id}
            className={`chat-msg ${it.mine ? 'mine' : 'theirs'} ${it.kind === 'caption' ? 'is-caption' : ''}`}
          >
            {!it.mine && (
              <span className="chat-from">
                {it.from}
                {it.kind === 'caption' ? (it.sign ? ' ✋' : ' 🎙') : ''}
              </span>
            )}
            <span className="chat-bubble">{it.text}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="chat-input">
        <input
          className="field"
          placeholder="메시지"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <button className="ctrl send" onClick={submit} disabled={!text.trim() || isSending} aria-label="보내기">
          <SendIcon />
        </button>
      </div>
    </div>
  )
}
