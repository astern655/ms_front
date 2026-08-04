import { useEffect, useRef, useState } from 'react'
import { listDocs, createDoc, saveDoc, deleteDoc, type Doc, type DocScope } from '../lib/docs'

const SCOPES: { v: DocScope; l: string }[] = [
  { v: 'personal', l: '개인' },
  { v: 'team', l: '팀' },
  { v: 'meeting', l: '회의' },
  { v: 'group', l: '그룹 전체' },
]
const scopeLabel = (v: DocScope) => SCOPES.find((s) => s.v === v)?.l ?? v

export function DocsView({ groupId }: { groupId: string }) {
  const [docs, setDocs] = useState<Doc[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [scope, setScope] = useState<DocScope>('personal')
  const [saved, setSaved] = useState(true)
  const [error, setError] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const open = (d: Doc) => {
    setActiveId(d.id)
    setTitle(d.title)
    setContent(d.content)
    setScope(d.scope)
    setSaved(true)
  }
  const clear = () => {
    setActiveId(null)
    setTitle('')
    setContent('')
  }

  useEffect(() => {
    listDocs(groupId)
      .then((ds) => {
        setDocs(ds)
        if (ds[0]) open(ds[0])
        else clear()
      })
      .catch((e) => setError((e as Error).message))
  }, [groupId])

  const schedule = (t: string, c: string) => {
    setSaved(false)
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      if (!activeId) return
      try {
        await saveDoc(activeId, { title: t, content: c })
        setSaved(true)
        setDocs((prev) => prev.map((d) => (d.id === activeId ? { ...d, title: t, content: c } : d)))
      } catch (e) {
        setError((e as Error).message)
      }
    }, 700)
  }

  // Changing share scope is an explicit decision → save immediately.
  const changeScope = async (s: DocScope) => {
    setScope(s)
    if (!activeId) return
    try {
      await saveDoc(activeId, { scope: s })
      setDocs((prev) => prev.map((d) => (d.id === activeId ? { ...d, scope: s } : d)))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const add = async (s: DocScope) => {
    try {
      const d = await createDoc(groupId, s)
      setDocs((prev) => [d, ...prev])
      open(d)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const del = async () => {
    if (!activeId) return
    try {
      await deleteDoc(activeId)
      const rest = docs.filter((d) => d.id !== activeId)
      setDocs(rest)
      if (rest[0]) open(rest[0])
      else clear()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="docs-view">
      <aside className="docs-list glass">
        <button className="btn-mini" onClick={() => add('personal')}>
          + 새 문서
        </button>
        {SCOPES.map((s) => {
          const items = docs.filter((d) => d.scope === s.v)
          return (
            <div key={s.v} className="doc-section">
              <div className="doc-section-title">{s.l}</div>
              {items.map((d) => (
                <button
                  key={d.id}
                  className={`doc-item ${d.id === activeId ? 'on' : ''}`}
                  onClick={() => open(d)}
                >
                  {d.title || '제목 없음'}
                </button>
              ))}
            </div>
          )
        })}
      </aside>

      <div className="docs-editor glass">
        {activeId ? (
          <>
            <div className="docs-editor-head">
              <input
                className="doc-title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                  schedule(e.target.value, content)
                }}
                placeholder="제목"
              />
              <span className="save-state">{saved ? '저장됨' : '저장 중…'}</span>
              <button className="danger-btn" onClick={del}>
                삭제
              </button>
            </div>

            <div className="doc-scope">
              <span className="subtitle" style={{ margin: 0 }}>공유 범위</span>
              <div className="segmented compact">
                {SCOPES.map((s) => (
                  <button
                    key={s.v}
                    aria-selected={scope === s.v}
                    onClick={() => changeScope(s.v)}
                  >
                    {s.l}
                  </button>
                ))}
              </div>
              <span className="scope-hint">
                {scope === 'personal'
                  ? '나만 봅니다'
                  : scope === 'group'
                    ? '그룹(회사) 전체 공유'
                    : `${scopeLabel(scope)} 공유`}
              </span>
            </div>

            <textarea
              className="doc-content"
              value={content}
              onChange={(e) => {
                setContent(e.target.value)
                schedule(title, e.target.value)
              }}
              placeholder="내용을 입력하세요 — 자료 정리, 회의 노트, 결정사항…"
            />
          </>
        ) : (
          <div className="ws-empty">
            <p className="subtitle">문서를 선택하거나 새로 만드세요</p>
          </div>
        )}
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  )
}
