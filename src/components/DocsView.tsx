import { useEffect, useRef, useState } from 'react'
import { listDocs, createDoc, saveDoc, deleteDoc, type Doc } from '../lib/docs'

export function DocsView({ groupId }: { groupId: string }) {
  const [docs, setDocs] = useState<Doc[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [saved, setSaved] = useState(true)
  const [error, setError] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const open = (d: Doc) => {
    setActiveId(d.id)
    setTitle(d.title)
    setContent(d.content)
    setSaved(true)
  }

  useEffect(() => {
    listDocs(groupId)
      .then((ds) => {
        setDocs(ds)
        if (ds[0]) open(ds[0])
        else {
          setActiveId(null)
          setTitle('')
          setContent('')
        }
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

  const add = async () => {
    try {
      const d = await createDoc(groupId)
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
      else {
        setActiveId(null)
        setTitle('')
        setContent('')
      }
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="docs-view">
      <aside className="docs-list glass">
        <button className="btn-mini" onClick={add}>
          + 새 문서
        </button>
        {docs.map((d) => (
          <button
            key={d.id}
            className={`doc-item ${d.id === activeId ? 'on' : ''}`}
            onClick={() => open(d)}
          >
            {d.title || '제목 없음'}
          </button>
        ))}
        {docs.length === 0 && <p className="ws-hint">문서를 만들어 자료·회의를 정리하세요</p>}
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
