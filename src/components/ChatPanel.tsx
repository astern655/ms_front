import { useEffect, useRef, useState } from 'react'
import { useChat, useLocalParticipant } from '@livekit/components-react'
import { SendIcon, CloseIcon } from './icons'

export function ChatPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { chatMessages, send, isSending } = useChat()
  const { localParticipant } = useLocalParticipant()
  const [text, setText] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, open])

  const submit = async () => {
    const t = text.trim()
    if (!t || isSending) return
    await send(t)
    setText('')
  }

  if (!open) return null
  return (
    <div className="glass chat-panel" role="dialog" aria-label="채팅">
      <div className="chat-head">
        <h2>채팅</h2>
        <button className="icon-btn small" onClick={onClose} aria-label="닫기">
          <CloseIcon />
        </button>
      </div>

      <div className="chat-list">
        {chatMessages.length === 0 && (
          <p className="chat-empty">첫 메시지를 보내 대화를 시작하세요.</p>
        )}
        {chatMessages.map((m) => {
          const mine = m.from?.identity === localParticipant.identity
          return (
            <div key={m.id ?? m.timestamp} className={`chat-msg ${mine ? 'mine' : 'theirs'}`}>
              {!mine && <span className="chat-from">{m.from?.identity ?? '익명'}</span>}
              <span className="chat-bubble">{m.message}</span>
            </div>
          )
        })}
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
