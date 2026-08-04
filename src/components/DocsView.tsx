import { useEffect, useRef, useState } from 'react'
import { listDocs, createDoc, saveDoc, deleteDoc, type Doc, type DocScope } from '../lib/docs'
import { DocEditor } from './DocEditor'

const SCOPES: { v: DocScope; l: string }[] = [
  { v: 'personal', l: '개인' },
  { v: 'team', l: '팀' },
  { v: 'meeting', l: '회의' },
  { v: 'group', l: '그룹 전체' },
]
const scopeLabel = (v: DocScope) => SCOPES.find((s) => s.v === v)?.l ?? v

export function DocsView({ groupId, compact = false }: { groupId: string; compact?: boolean }) {
  const [docs, setDocs] = useState<Doc[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [activeContent, setActiveContent] = useState('')
  const [scope, setScope] = useState<DocScope>('personal')
  const [scopeMenu, setScopeMenu] = useState(false)
  const [saved, setSaved] = useState(true)
  const [error, setError] = useState('')
  const titleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const open = (d: Doc) => {
    setActiveId(d.id)
    setTitle(d.title)
    setActiveContent(d.content)
    setScope(d.scope)
    setSaved(true)
  }
  const clear = () => {
    setActiveId(null)
    setTitle('')
    setActiveContent('')
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

  const onTitle = (t: string) => {
    setTitle(t)
    setSaved(false)
    clearTimeout(titleTimer.current)
    titleTimer.current = setTimeout(async () => {
      if (!activeId) return
      await saveDoc(activeId, { title: t }).catch((e) => setError((e as Error).message))
      setSaved(true)
      setDocs((prev) => prev.map((d) => (d.id === activeId ? { ...d, title: t } : d)))
    }, 500)
  }

  const onContent = async (json: string) => {
    if (!activeId) return
    setSaved(false)
    await saveDoc(activeId, { content: json }).catch((e) => setError((e as Error).message))
    setSaved(true)
  }

  const changeScope = async (s: DocScope) => {
    setScope(s)
    if (!activeId) return
    await saveDoc(activeId, { scope: s }).catch((e) => setError((e as Error).message))
    setDocs((prev) => prev.map((d) => (d.id === activeId ? { ...d, scope: s } : d)))
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
    <div className={`docs-view ${compact ? 'compact' : ''}`}>
      {compact ? (
        <div className="docs-compact-bar">
          <select
            className="field"
            value={activeId ?? ''}
            onChange={(e) => {
              const d = docs.find((x) => x.id === e.target.value)
              if (d) open(d)
            }}
          >
            {docs.length === 0 && <option value="">문서 없음</option>}
            {docs.map((d) => (
              <option key={d.id} value={d.id}>
                [{scopeLabel(d.scope)}] {d.title || '제목 없음'}
              </option>
            ))}
          </select>
          <button className="btn-mini" onClick={() => add('personal')}>
            + 새
          </button>
        </div>
      ) : (
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
      )}

      <div className="docs-editor glass">
        {activeId ? (
          <>
            <div className="docs-editor-head">
              <input
                className="doc-title"
                value={title}
                onChange={(e) => onTitle(e.target.value)}
                placeholder="제목 없음"
              />
              <span className="save-state">{saved ? '저장됨' : '…'}</span>
              <div className="scope-control">
                <button className="scope-chip" onClick={() => setScopeMenu((v) => !v)} title="공유 범위">
                  {scopeLabel(scope)} ▾
                </button>
                {scopeMenu && (
                  <>
                    <div className="menu-catch" onClick={() => setScopeMenu(false)} />
                    <div className="scope-menu glass">
                      {SCOPES.map((s) => (
                        <button
                          key={s.v}
                          className={scope === s.v ? 'on' : ''}
                          onClick={() => {
                            changeScope(s.v)
                            setScopeMenu(false)
                          }}
                        >
                          {s.l}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <button className="icon-btn small" onClick={del} aria-label="문서 삭제" title="삭제">
                ✕
              </button>
            </div>
            <DocEditor key={activeId} content={activeContent} onChange={onContent} />
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
