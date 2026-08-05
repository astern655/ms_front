import { useEffect, useRef, useState } from 'react'
import {
  loadAgent,
  saveAgentConfig,
  askAgent,
  reindexRag,
  type Agent,
  type AgentSkills,
} from '../lib/rag'

type Msg = { role: 'user' | 'ai'; text: string; sources?: string[] }

const SKILLS: { key: keyof AgentSkills; label: string; desc: string }[] = [
  { key: 'docs_rag', label: '문서 검색', desc: '팀 문서·회의 기록을 근거로 답변' },
  { key: 'summarize', label: '요약', desc: '핵심을 간결히 정리' },
  { key: 'action_items', label: '액션 아이템', desc: '할 일을 목록으로 추출' },
  { key: 'translate', label: '번역', desc: '원하는 언어로 번역' },
]

const DEFAULT_AGENT: Agent = {
  name: '팀 에이전트',
  system_prompt: '',
  skills: { docs_rag: true, summarize: true, action_items: false, translate: false },
}

export function AiPanel({ groupId, teamId = null }: { groupId: string; teamId?: string | null }) {
  const [agent, setAgent] = useState<Agent>(DEFAULT_AGENT)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [settings, setSettings] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  const scroll = () =>
    requestAnimationFrame(() => listRef.current?.scrollTo({ top: 1e9, behavior: 'smooth' }))

  // Load agent config + team session.
  useEffect(() => {
    let alive = true
    loadAgent(groupId, teamId)
      .then(({ agent, messages }) => {
        if (!alive) return
        setAgent({ ...DEFAULT_AGENT, ...agent, skills: { ...DEFAULT_AGENT.skills, ...agent.skills } })
        setMsgs(messages.map((m) => ({ role: m.role, text: m.content, sources: m.sources ?? undefined })))
        scroll()
      })
      .catch((e) => setNote((e as Error).message))
    return () => {
      alive = false
    }
  }, [groupId, teamId])

  const ask = async () => {
    const question = q.trim()
    if (!question || busy) return
    setQ('')
    setMsgs((m) => [...m, { role: 'user', text: question }])
    setBusy(true)
    scroll()
    try {
      const { answer, sources } = await askAgent(groupId, teamId, question)
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

  const toggleSkill = (key: keyof AgentSkills) =>
    setAgent((a) => ({ ...a, skills: { ...a.skills, [key]: !a.skills[key] } }))

  const saveConfig = async () => {
    setBusy(true)
    try {
      await saveAgentConfig(groupId, { name: agent.name, skills: agent.skills })
      setNote('에이전트 설정 저장됨')
      setSettings(false)
    } catch (e) {
      setNote(`오류: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="ai-panel dock-fill">
      <div className="ai-head">
        <span className="ai-title">{agent.name}</span>
        <button
          className={`ai-gear ${settings ? 'on' : ''}`}
          onClick={() => setSettings((v) => !v)}
          title="에이전트 설정"
        >
          설정
        </button>
        <button className="btn-mini" onClick={reindex} disabled={busy} title="문서를 다시 색인">
          다시 색인
        </button>
      </div>
      {note && <p className="ai-note">{note}</p>}

      {settings ? (
        <div className="ai-settings">
          <label className="ai-field">
            <span>에이전트 이름</span>
            <input
              className="field"
              value={agent.name}
              onChange={(e) => setAgent((a) => ({ ...a, name: e.target.value }))}
            />
          </label>
          <div className="ai-skills-title">스킬</div>
          {SKILLS.map((s) => (
            <button
              key={s.key}
              className={`ai-skill ${agent.skills[s.key] ? 'on' : ''}`}
              onClick={() => toggleSkill(s.key)}
            >
              <span className="ai-skill-text">
                <span className="ai-skill-label">{s.label}</span>
                <span className="ai-skill-desc">{s.desc}</span>
              </span>
              <span className="ai-switch" aria-hidden />
            </button>
          ))}
          <button className="ai-send ai-save" onClick={saveConfig} disabled={busy}>
            설정 저장
          </button>
        </div>
      ) : (
        <>
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
            {busy && (
              <div className="ai-msg ai">
                <div className="ai-bubble">…</div>
              </div>
            )}
          </div>
          <div className="chat-input ai-input">
            <input
              className="field"
              value={q}
              placeholder="질문을 입력하세요"
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && ask()}
            />
            <button className="ai-send" onClick={ask} disabled={busy}>
              보내기
            </button>
          </div>
        </>
      )}
    </div>
  )
}
