import { useEffect, useRef, useState } from 'react'
import { listDocs, createDoc, saveDoc, deleteDoc, type Doc, type DocScope } from '../lib/docs'
import { DocEditor } from './DocEditor'
import { Select } from './Select'

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
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
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

  const addChild = async (parent: Doc) => {
    try {
      const d = await createDoc(groupId, parent.scope, parent.id)
      setDocs((prev) => [d, ...prev])
      setExpanded((prev) => new Set(prev).add(parent.id))
      open(d)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const renderNode = (d: Doc, depth: number) => {
    const kids = docs.filter((c) => c.parent_id === d.id)
    const isOpen = expanded.has(d.id)
    return (
      <div key={d.id}>
        <div
          className={`doc-item tree ${d.id === activeId ? 'on' : ''}`}
          style={{ paddingLeft: 6 + depth * 14 }}
        >
          {kids.length > 0 ? (
            <button className="doc-caret" onClick={() => toggleExpand(d.id)}>
              {isOpen ? '▾' : '▸'}
            </button>
          ) : (
            <span className="doc-caret spacer" />
          )}
          <button className="doc-title-btn" onClick={() => open(d)}>
            {d.title || '제목 없음'}
          </button>
          <button className="doc-add-child" title="하위 페이지 추가" onClick={() => addChild(d)}>
            +
          </button>
        </div>
        {isOpen && kids.map((c) => renderNode(c, depth + 1))}
      </div>
    )
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
          <div style={{ flex: 1 }}>
            <Select
              value={activeId ?? ''}
              placeholder="문서 없음"
              onChange={(id) => {
                const d = docs.find((x) => x.id === id)
                if (d) open(d)
              }}
              options={docs.map((d) => ({
                value: d.id,
                label: `${d.parent_id ? '↳ ' : ''}[${scopeLabel(d.scope)}] ${d.title || '제목 없음'}`,
              }))}
            />
          </div>
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
            const roots = docs.filter((d) => d.scope === s.v && !d.parent_id)
            return (
              <div key={s.v} className="doc-section">
                <div className="doc-section-title">{s.l}</div>
                {roots.map((d) => renderNode(d, 0))}
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
