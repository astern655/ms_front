import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { listDocs, createDoc, saveDoc, deleteDoc, type Doc, type DocScope } from './docs'
import { DocEditor } from './DocEditor'
import {
  listComments,
  addComment,
  deleteComment,
  listVersions,
  saveVersion,
  type DocComment,
  type DocVersion,
} from './collab'

const SCOPES: { v: DocScope; l: string }[] = [
  { v: 'personal', l: '개인' },
  { v: 'team', l: '팀' },
  { v: 'meeting', l: '회의' },
  { v: 'group', l: '그룹 전체' },
]
const scopeLabel = (v: DocScope) => SCOPES.find((s) => s.v === v)?.l ?? v

// --- Templates (BlockNote block builders) ---
type Block = { type: string; props?: Record<string, unknown>; content: unknown; children?: Block[] }
const H = (level: number, text: string): Block => ({
  type: 'heading',
  props: { level },
  content: [{ type: 'text', text, styles: {} }],
})
const P = (text = ''): Block => ({
  type: 'paragraph',
  content: text ? [{ type: 'text', text, styles: {} }] : [],
})
const B = (text: string): Block => ({ type: 'bulletListItem', content: [{ type: 'text', text, styles: {} }] })
const C = (text: string): Block => ({
  type: 'checkListItem',
  props: { checked: false },
  content: [{ type: 'text', text, styles: {} }],
})

const TEMPLATES: { key: string; label: string; title: string; blocks: Block[] | null }[] = [
  { key: 'blank', label: '빈 문서', title: '', blocks: null },
  {
    key: 'meeting',
    label: '회의록',
    title: '회의록',
    blocks: [
      H(1, '회의록'),
      H(2, '참석자'),
      B('이름 · 역할'),
      H(2, '안건'),
      B('논의할 주제'),
      H(2, '논의 내용'),
      P(),
      H(2, '결정 사항'),
      B('무엇을 정했는지'),
      H(2, '액션 아이템'),
      C('담당 · 할 일 · 기한'),
    ],
  },
  {
    key: 'action',
    label: '액션 아이템',
    title: '액션 아이템',
    blocks: [H(1, '액션 아이템'), C('담당 · 할 일 · 기한'), C(''), C('')],
  },
  {
    key: 'prd',
    label: 'PRD',
    title: 'PRD',
    blocks: [
      H(1, 'PRD'),
      H(2, '배경 · 문제'),
      P(),
      H(2, '목표'),
      B('무엇을 달성하나'),
      H(2, '요구사항'),
      B('핵심 기능'),
      H(2, '범위'),
      P('포함 / 제외'),
      H(2, '성공 지표'),
      B('어떻게 측정하나'),
    ],
  },
]

// --- Lossy BlockNote → Markdown export ---
function inlineMd(content: unknown): string {
  if (!Array.isArray(content)) return ''
  return content
    .map((r: { text?: string; styles?: Record<string, boolean> }) => {
      let t = r.text ?? ''
      const s = r.styles || {}
      if (s.code) t = '`' + t + '`'
      if (s.bold) t = '**' + t + '**'
      if (s.italic) t = '*' + t + '*'
      return t
    })
    .join('')
}
function blockMd(b: Block, depth = 0): string {
  const pad = '  '.repeat(depth)
  const c = inlineMd(b.content)
  const lvl = (b.props?.level as number) || 1
  let line: string
  switch (b.type) {
    case 'heading':
      line = '#'.repeat(lvl) + ' ' + c
      break
    case 'bulletListItem':
      line = pad + '- ' + c
      break
    case 'numberedListItem':
      line = pad + '1. ' + c
      break
    case 'checkListItem':
      line = pad + '- [' + (b.props?.checked ? 'x' : ' ') + '] ' + c
      break
    case 'codeBlock':
      line = '```\n' + c + '\n```'
      break
    default:
      line = c
  }
  const kids = Array.isArray(b.children) ? b.children.map((k) => blockMd(k, depth + 1)).join('\n') : ''
  return kids ? line + '\n' + kids : line
}
function blocksToMarkdown(json: string): string {
  try {
    const blocks = JSON.parse(json)
    if (!Array.isArray(blocks)) return json
    return blocks.map((b: Block) => blockMd(b)).join('\n\n')
  } catch {
    return json
  }
}

export function DocsView({
  groupId,
  lang = 'ko',
  userId,
  userName,
}: {
  groupId: string
  lang?: string
  userId?: string
  userName?: string
}) {
  const [docs, setDocs] = useState<Doc[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [activeContent, setActiveContent] = useState('')
  const [scope, setScope] = useState<DocScope>('personal')
  const [scopeMenu, setScopeMenu] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [saved, setSaved] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [newMenu, setNewMenu] = useState(false)
  const [sidePanel, setSidePanel] = useState<'comments' | 'versions' | null>(null)
  const [comments, setComments] = useState<DocComment[]>([])
  const [versions, setVersions] = useState<DocVersion[]>([])
  const [newComment, setNewComment] = useState('')
  const favKey = `borderless.fav.${groupId}`
  const [favs, setFavs] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(`borderless.fav.${groupId}`) || '[]'))
    } catch {
      return new Set()
    }
  })
  const toggleFav = (id: string) =>
    setFavs((prev) => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      localStorage.setItem(favKey, JSON.stringify([...n]))
      return n
    })
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

  const addTemplate = async (t: (typeof TEMPLATES)[number]) => {
    setNewMenu(false)
    try {
      const d = await createDoc(groupId, 'personal')
      let doc = d
      if (t.blocks) {
        const content = JSON.stringify(t.blocks)
        await saveDoc(d.id, { title: t.title, content })
        doc = { ...d, title: t.title, content }
      }
      setDocs((prev) => [doc, ...prev])
      open(doc)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  // Load comments + realtime for the open doc.
  useEffect(() => {
    if (!activeId) {
      setComments([])
      return
    }
    listComments(activeId).then(setComments).catch(() => {})
    const ch = supabase
      .channel(`doc:${activeId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'doc_comments', filter: `doc_id=eq.${activeId}` },
        () => listComments(activeId).then(setComments).catch(() => {}),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [activeId])

  const postComment = async () => {
    const content = newComment.trim()
    if (!content || !activeId || !userId) return
    setNewComment('')
    try {
      await addComment({ docId: activeId, groupId, userId, name: userName ?? '나', content })
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const openVersions = async () => {
    setSidePanel('versions')
    if (activeId) listVersions(activeId).then(setVersions).catch((e) => setError((e as Error).message))
  }

  const snapshotVersion = async () => {
    if (!activeId || !userId) return
    try {
      await saveVersion({ docId: activeId, groupId, title, content: activeContent, userId })
      setVersions(await listVersions(activeId))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const restoreVersion = async (v: DocVersion) => {
    if (!activeId) return
    try {
      await saveDoc(activeId, { title: v.title ?? '', content: v.content ?? '' })
      setActiveContent(v.content ?? '')
      setTitle(v.title ?? '')
      setDocs((prev) => prev.map((d) => (d.id === activeId ? { ...d, title: v.title ?? '' } : d)))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const exportMd = () => {
    const md = `# ${title || '제목 없음'}\n\n${blocksToMarkdown(activeContent)}`
    const blob = new Blob([md], { type: 'text/markdown' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${(title || 'document').replace(/[\\/:*?"<>|]/g, '_')}.md`
    a.click()
    URL.revokeObjectURL(a.href)
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
          <button
            className={`doc-star ${favs.has(d.id) ? 'on' : ''}`}
            title="즐겨찾기"
            onClick={() => toggleFav(d.id)}
          >
            {favs.has(d.id) ? '★' : '☆'}
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
    <div className="docs-view">
      <aside className="docs-list glass">
        <div className="docs-new">
          <button className="btn-mini" onClick={() => add('personal')}>
            + 새 문서
          </button>
          <button className="btn-mini ghost docs-new-caret" onClick={() => setNewMenu((v) => !v)} title="템플릿">
            ▾
          </button>
          {newMenu && (
            <>
              <div className="menu-catch" onClick={() => setNewMenu(false)} />
              <div className="docs-tpl-menu glass">
                {TEMPLATES.map((t) => (
                  <button key={t.key} onClick={() => addTemplate(t)}>
                    {t.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <input
          className="field docs-search"
          placeholder="문서 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {query.trim() ? (
          <div className="doc-section">
            <div className="doc-section-title">검색 결과</div>
            {docs
              .filter((d) => (d.title || '제목 없음').toLowerCase().includes(query.trim().toLowerCase()))
              .map((d) => (
                <div key={d.id} className={`doc-item tree ${d.id === activeId ? 'on' : ''}`}>
                  <span className="doc-caret spacer" />
                  <button className="doc-title-btn" onClick={() => open(d)}>
                    {d.title || '제목 없음'}
                  </button>
                </div>
              ))}
          </div>
        ) : (
          <>
            {(() => {
              const favDocs = docs.filter((d) => favs.has(d.id))
              const recent = [...docs]
                .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))
                .slice(0, 4)
              const flatRow = (d: Doc) => (
                <div key={d.id} className={`doc-item tree ${d.id === activeId ? 'on' : ''}`}>
                  <span className="doc-caret spacer" />
                  <button className="doc-title-btn" onClick={() => open(d)}>
                    {d.title || '제목 없음'}
                  </button>
                </div>
              )
              return (
                <>
                  {favDocs.length > 0 && (
                    <div className="doc-section">
                      <div className="doc-section-title">★ 즐겨찾기</div>
                      {favDocs.map(flatRow)}
                    </div>
                  )}
                  {recent.length > 0 && (
                    <div className="doc-section">
                      <div className="doc-section-title">최근</div>
                      {recent.map(flatRow)}
                    </div>
                  )}
                </>
              )
            })()}
            {SCOPES.map((s) => {
              const roots = docs.filter((d) => d.scope === s.v && !d.parent_id)
              return (
                <div key={s.v} className="doc-section">
                  <div className="doc-section-title">{s.l}</div>
                  {roots.map((d) => renderNode(d, 0))}
                </div>
              )
            })}
          </>
        )}
      </aside>

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
              <button
                className={`btn-mini ghost ${sidePanel === 'comments' ? 'on' : ''}`}
                onClick={() => setSidePanel((p) => (p === 'comments' ? null : 'comments'))}
              >
                댓글{comments.length > 0 ? ` ${comments.length}` : ''}
              </button>
              <button
                className={`btn-mini ghost ${sidePanel === 'versions' ? 'on' : ''}`}
                onClick={() => (sidePanel === 'versions' ? setSidePanel(null) : openVersions())}
              >
                버전
              </button>
              <button className="btn-mini ghost" onClick={exportMd} title="마크다운으로 내보내기">
                내보내기
              </button>
              <button className="icon-btn small" onClick={del} aria-label="문서 삭제" title="삭제">
                ✕
              </button>
            </div>
            <div className="docs-editor-body">
              <DocEditor
                key={activeId}
                docId={activeId}
                groupId={groupId}
                userName={userName}
                content={activeContent}
                onChange={onContent}
                lang={lang}
              />

              {sidePanel === 'comments' && (
                <aside className="doc-side">
                  <div className="doc-side-head">댓글 {comments.length}</div>
                  <div className="doc-side-list">
                    {comments.length === 0 && <p className="ai-empty">첫 댓글을 남겨보세요.</p>}
                    {comments.map((c) => (
                      <div key={c.id} className="doc-comment">
                        <div className="doc-comment-head">
                          <span className="doc-comment-author">{c.author_name}</span>
                          <span className="chat-time">
                            {new Date(c.created_at).toLocaleString('ko-KR', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {c.user_id === userId && (
                            <button
                              className="doc-comment-del"
                              onClick={() => deleteComment(c.id).catch(() => {})}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                        <div className="doc-comment-body">{c.content}</div>
                      </div>
                    ))}
                  </div>
                  {userId && (
                    <div className="chat-input doc-comment-compose">
                      <input
                        className="field"
                        placeholder="댓글 달기"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && postComment()}
                      />
                      <button className="ai-send" onClick={postComment}>
                        등록
                      </button>
                    </div>
                  )}
                </aside>
              )}

              {sidePanel === 'versions' && (
                <aside className="doc-side">
                  <div className="doc-side-head">
                    버전 히스토리
                    {userId && (
                      <button className="btn-mini" onClick={snapshotVersion}>
                        현재 저장
                      </button>
                    )}
                  </div>
                  <div className="doc-side-list">
                    {versions.length === 0 && <p className="ai-empty">저장된 버전이 없어요.</p>}
                    {versions.map((v) => (
                      <div key={v.id} className="doc-version">
                        <div className="doc-version-meta">
                          <span className="doc-version-title">{v.title || '제목 없음'}</span>
                          <span className="chat-time">
                            {new Date(v.created_at).toLocaleString('ko-KR', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <button className="btn-mini ghost" onClick={() => restoreVersion(v)}>
                          복원
                        </button>
                      </div>
                    ))}
                  </div>
                </aside>
              )}
            </div>
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
