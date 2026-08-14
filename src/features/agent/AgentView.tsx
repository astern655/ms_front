import { useEffect, useState } from 'react'
import {
  planAgent,
  proceedAgent,
  reindexRag,
  runAgent,
  type AgentArtifact,
  type AgentMode,
} from './rag'
import { createDoc, saveDoc } from '../docs/docs'
import { listTeams, type Group, type Team } from '../groups/teams'
import { Select } from '../../components/ui/Select'

const MODES: { key: AgentMode; label: string; hint: string }[] = [
  { key: 'meeting_summary', label: '회의 요약', hint: '결정·근거 구조화' },
  { key: 'decisions', label: '결정 추출', hint: '담당자·기한 표' },
  { key: 'action_plan', label: '실행 계획', hint: '승인 전 계획' },
  { key: 'ppt_draft', label: 'PPT 초안', hint: '대표 산출물' },
  { key: 'task_draft', label: '태스크', hint: 'Notion·Jira 초안' },
  { key: 'prd', label: 'PRD', hint: '제품 요구사항 문서' },
  { key: 'report', label: '보고서', hint: '진행·논의 정리' },
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
export function AgentView({
  groups,
  activeGroupId,
}: {
  groups: Group[]
  activeGroupId: string
}) {
  const [groupId, setGroupId] = useState(activeGroupId)
  const [teams, setTeams] = useState<Team[]>([])
  const [teamId, setTeamId] = useState<string>('')
  const [mode, setMode] = useState<AgentMode>('ppt_draft')
  const [direction, setDirection] = useState('')
  const [meetingTranscript, setMeetingTranscript] = useState('')
  const [plan, setPlan] = useState<AgentArtifact | null>(null)
  const [result, setResult] = useState<AgentArtifact | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState(false)

  // Load teams whenever the selected group changes.
  useEffect(() => {
    setTeamId('')
    listTeams(groupId)
      .then(setTeams)
      .catch((e) => setNote((e as Error).message))
  }, [groupId])

  const scopedDirection = () => {
    const teamName = teams.find((t) => t.id === teamId)?.name
    return (teamName ? `[대상 팀: ${teamName}] ` : '') + direction.trim()
  }

  const buildPlan = async () => {
    if (busy) return
    setBusy(true)
    setNote('')
    setPlan(null)
    setResult(null)
    setSaved(false)
    try {
      const p = await planAgent(groupId, scopedDirection(), meetingTranscript.trim())
      setPlan(p)
      setNote('실행 계획이 준비됐습니다. 내용을 확인한 뒤 proceed를 누르세요.')
    } catch (e) {
      setNote(`오류: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const proceed = async () => {
    if (busy || !plan) return
    setBusy(true)
    setNote('')
    setResult(null)
    setSaved(false)
    try {
      const r = await proceedAgent({
        groupId,
        direction: scopedDirection(),
        meetingTranscript: meetingTranscript.trim(),
        executionPlan: plan.content,
        mode,
      })
      setResult(r)
      setNote('승인된 실행 계획으로 산출물을 생성했습니다.')
    } catch (e) {
      setNote(`오류: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const runDirect = async () => {
    if (busy) return
    setBusy(true)
    setNote('')
    setResult(null)
    setSaved(false)
    try {
      const r = await runAgent(groupId, mode, scopedDirection(), meetingTranscript.trim())
      setResult(r)
      setNote('승인 단계를 건너뛰고 산출물을 생성했습니다.')
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
          회사 문서와 회의 기록을 바탕으로 실행 계획을 제안하고, 승인 후 산출물을 생성합니다.
        </p>

        <div className="agent-scope">
          <label className="agent-field">
            <span>그룹</span>
            <Select
              value={groupId}
              onChange={setGroupId}
              options={groups.map((g) => ({ value: g.id, label: g.name }))}
            />
          </label>
          <label className="agent-field">
            <span>팀</span>
            <Select
              value={teamId}
              onChange={setTeamId}
              placeholder="전체"
              options={[
                { value: '', label: '그룹 전체' },
                ...teams.map((t) => ({ value: t.id, label: t.name })),
              ]}
            />
          </label>
        </div>

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
          placeholder="원하는 방향·목표를 적어주세요. 예: 이번 제품 출시 회의 결과를 고객 공유용 PPT 초안으로 정리"
          value={direction}
          onChange={(e) => setDirection(e.target.value)}
        />

        <textarea
          className="field agent-direction"
          rows={7}
          placeholder="회의 transcript 또는 회의 메모를 붙여넣으세요. 한·영 혼합 발언, 결정사항 후보, 담당자, 기한이 포함되면 좋습니다."
          value={meetingTranscript}
          onChange={(e) => setMeetingTranscript(e.target.value)}
        />

        <button className="btn-primary agent-run" onClick={buildPlan} disabled={busy}>
          {busy ? '처리 중…' : '실행 계획 만들기'}
        </button>
        <button className="btn-mini ghost agent-secondary" onClick={runDirect} disabled={busy}>
          바로 산출물 생성
        </button>
        {note && <p className="agent-note">{note}</p>}
      </div>

      <div className="agent-result glass">
        {plan || result ? (
          <>
            <div className="agent-result-head">
              <div>
                <p className="agent-kicker">
                  {result ? '생성된 산출물' : '승인 대기 실행 계획'}
                </p>
                <h3>{(result ?? plan)?.title}</h3>
              </div>
              <div className="agent-actions">
                {plan && !result && (
                  <button className="btn-mini" onClick={proceed} disabled={busy}>
                    proceed
                  </button>
                )}
                {result && (
                  <button className="btn-mini" onClick={saveAsDoc} disabled={busy || saved}>
                    {saved ? '저장됨' : '문서로 저장'}
                  </button>
                )}
              </div>
            </div>
            {(result ?? plan)?.nextAction && <p className="agent-note">{(result ?? plan)?.nextAction}</p>}
            {(result ?? plan)!.selectedSkills.length > 0 && (
              <div className="agent-skill-strip">
                {(result ?? plan)!.selectedSkills.map((skill) => (
                  <span key={skill.id} className="agent-skill" title={skill.purpose}>
                    {skill.label}
                  </span>
                ))}
              </div>
            )}
            {(result ?? plan)!.sources.length > 0 && (
              <div className="ai-sources">
                {(result ?? plan)!.sources.map((s, i) => (
                  <span key={i} className="ai-src">
                    {s}
                  </span>
                ))}
              </div>
            )}
            <div className="agent-output">{(result ?? plan)?.content}</div>
          </>
        ) : (
          <div className="agent-empty">
            <p className="subtitle">방향과 회의 기록을 입력한 뒤 “실행 계획 만들기”를 누르세요.</p>
          </div>
        )}
      </div>
    </div>
  )
}
