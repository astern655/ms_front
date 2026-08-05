import { useState } from 'react'
import { runAgent, reindexRag, type AgentMode } from '../lib/rag'
import { createDoc, saveDoc } from '../lib/docs'

const MODES: { key: AgentMode; label: string; hint: string }[] = [
  { key: 'prd', label: 'PRD', hint: '제품 요구사항 문서' },
  { key: 'report', label: '보고서', hint: '진행·논의 정리' },
  { key: 'plan', label: '계획', hint: '실행 계획·WBS' },
  { key: 'design', label: '디자인', hint: '디자인 방향서' },
  { key: 'dev', label: '개발', hint: '개발 계획·명세' },
]

type Inline = { type: 'text'; text: string; styles: Record<string, boolean> }
type Block = { type: string; props?: Record<string, unknown>; content: Inline[]; children?: Block[] }

// Parse inline markdown: **bold**, *italic*, `code`.
function parseInline(text: string): Inline[] {
  const runs: Inline[] = []
  const re = /\*\*([^*]+)\*\*|`([^`]+)`|\*([^*]+)\*/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) runs.push({ type: 'text', text: text.slice(last, m.index), styles: {} })
    if (m[1] != null) runs.push({ type: 'text', text: m[1], styles: { bold: true } })
    else if (m[2] != null) runs.push({ type: 'text', text: m[2], styles: { code: true } })
    else if (m[3] != null) runs.push({ type: 'text', text: m[3], styles: { italic: true } })
    last = m.index + m[0].length
  }
  if (last < text.length) runs.push({ type: 'text', text: text.slice(last), styles: {} })
  return runs
}

// Markdown → BlockNote blocks (headings, bullet/numbered lists with nesting, paragraphs).
function toBlocks(md: string): string {
  const lines = md.replace(/\r/g, '').split('\n')
  const root: Block[] = []
  const stack: { indent: number; block: Block }[] = []

  const place = (indent: number, block: Block, isList: boolean) => {
    if (!isList) {
      root.push(block)
      stack.length = 0
      return
    }
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop()
    if (stack.length) (stack[stack.length - 1].block.children ??= []).push(block)
    else root.push(block)
    stack.push({ indent, block })
  }

  for (const raw of lines) {
    const t = raw.trim()
    if (!t) continue
    const indent = raw.length - raw.trimStart().length
    let m: RegExpMatchArray | null
    if ((m = t.match(/^(#{1,3})\s+(.*)$/))) {
      place(indent, { type: 'heading', props: { level: m[1].length }, content: parseInline(m[2]) }, false)
    } else if ((m = t.match(/^[-*]\s+(.*)$/))) {
      place(indent, { type: 'bulletListItem', content: parseInline(m[1]) }, true)
    } else if ((m = t.match(/^\d+\.\s+(.*)$/))) {
      place(indent, { type: 'numberedListItem', content: parseInline(m[1]) }, true)
    } else {
      place(indent, { type: 'paragraph', content: parseInline(t) }, false)
    }
  }
  return JSON.stringify(root)
}

// Higher-level agent: meeting/docs + direction → a deliverable (PRD/report/plan/design/dev).
export function AgentView({ groupId }: { groupId: string }) {
  const [mode, setMode] = useState<AgentMode>('prd')
  const [direction, setDirection] = useState('')
  const [result, setResult] = useState<{ title: string; content: string; sources: string[] } | null>(
    null,
  )
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState(false)

  const run = async () => {
    if (busy) return
    setBusy(true)
    setNote('')
    setResult(null)
    setSaved(false)
    try {
      const r = await runAgent(groupId, mode, direction.trim())
      setResult(r)
    } catch (e) {
      setNote(`오류: ${(e as Error).message}`)
    } finally {
      setBusy(false)
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

  const saveAsDoc = async () => {
    if (!result) return
    setBusy(true)
    try {
      const d = await createDoc(groupId, 'group')
      await saveDoc(d.id, { title: result.title, content: toBlocks(result.content) })
      setSaved(true)
      setNote('문서로 저장됨 (그룹 전체)')
    } catch (e) {
      setNote(`오류: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="agent-view">
      <div className="agent-controls glass">
        <div className="agent-head">
          <h2>에이전트</h2>
          <button className="btn-mini ghost" onClick={reindex} disabled={busy} title="문서를 다시 색인">
            다시 색인
          </button>
        </div>
        <p className="agent-sub">
          회의·문서 기록과 방향을 주면 산출물을 만들어 줍니다.
        </p>

        <div className="agent-modes">
          {MODES.map((m) => (
            <button
              key={m.key}
              className={`agent-mode ${mode === m.key ? 'on' : ''}`}
              onClick={() => setMode(m.key)}
            >
              <span className="agent-mode-label">{m.label}</span>
              <span className="agent-mode-hint">{m.hint}</span>
            </button>
          ))}
        </div>

        <textarea
          className="field agent-direction"
          rows={4}
          placeholder="원하는 방향·목표를 적어주세요. (예: '실시간 번역 회의 앱' MVP 범위로 PRD 작성)"
          value={direction}
          onChange={(e) => setDirection(e.target.value)}
        />

        <button className="btn-primary agent-run" onClick={run} disabled={busy}>
          {busy ? '생성 중…' : '산출물 생성'}
        </button>
        {note && <p className="agent-note">{note}</p>}
      </div>

      <div className="agent-result glass">
        {result ? (
          <>
            <div className="agent-result-head">
              <h3>{result.title}</h3>
              <button className="btn-mini" onClick={saveAsDoc} disabled={busy || saved}>
                {saved ? '저장됨' : '문서로 저장'}
              </button>
            </div>
            {result.sources.length > 0 && (
              <div className="ai-sources">
                {result.sources.map((s, i) => (
                  <span key={i} className="ai-src">
                    {s}
                  </span>
                ))}
              </div>
            )}
            <div className="agent-output">{result.content}</div>
          </>
        ) : (
          <div className="agent-empty">
            <p className="subtitle">산출물 종류를 고르고 방향을 입력한 뒤 “산출물 생성”을 누르세요.</p>
          </div>
        )}
      </div>
    </div>
  )
}
