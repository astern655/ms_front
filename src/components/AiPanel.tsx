import { useRef, useState } from 'react'
import { askRag, reindexRag } from '../lib/rag'

type Msg = { role: 'user' | 'ai'; text: string; sources?: string[] }

export function AiPanel({ groupId }: { groupId: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  const scroll = () =>
    requestAnimationFrame(() => listRef.current?.scrollTo({ top: 1e9, behavior: 'smooth' }))

  const ask = async () => {
    const question = q.trim()
    if (!question || busy) return
    setQ('')
    setMsgs((m) => [...m, { role: 'user', text: question }])
    setBusy(true)
    scroll()
    try {
      const { answer, sources } = await askRag(groupId, question)
      setMsgs((m) => [...m, { role: 'ai', text: answer, sources }])
    } catch (e) {
      setMsgs((m) => [...m, { role: 'ai', text: `오류: ${(e as Error).message}` }])
    } finally {
      setBusy(false)
      scroll()
    }
  }

  const reindex = async () => {
    setBusy(true)
    setNote('색인 중…')
    try {
      const { docs, chunks } = await reindexRag(groupId)
      setNote(`문서 ${docs}개 · 조각 ${chunks}개 색인 완료`)
    } catch (e) {
      setNote(`오류: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="ai-panel dock-fill">
      <div className="ai-head">
        <span className="ai-title">지식 어시스턴트</span>
        <button className="btn-mini" onClick={reindex} disabled={busy} title="문서를 다시 색인">
          다시 색인
        </button>
      </div>
      {note && <p className="ai-note">{note}</p>}
      <div className="ai-list" ref={listRef}>
        {msgs.length === 0 && (
          <p className="ai-empty">팀의 문서·회의 기록에 대해 무엇이든 물어보세요.</p>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`ai-msg ${m.role}`}>
            <div className="ai-bubble">{m.text}</div>
            {m.sources && m.sources.length > 0 && (
              <div className="ai-sources">
                {m.sources.map((s, j) => (
                  <span key={j} className="ai-src">
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {busy && <div className="ai-msg ai"><div className="ai-bubble">…</div></div>}
      </div>
      <div className="chat-input ai-input">
        <input
          className="field"
          value={q}
          placeholder="질문을 입력하세요"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ask()}
        />
        <button className="btn" onClick={ask} disabled={busy}>
          보내기
        </button>
      </div>
    </div>
  )
}
