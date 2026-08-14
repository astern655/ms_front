import { API_BASE } from '../../lib/api'

async function json<T>(res: Response): Promise<T> {
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'request failed')
  return data as T
}

// Chatbot: lightweight RAG Q&A.
export async function askRag(
  groupId: string,
  question: string,
): Promise<{ answer: string; sources: string[] }> {
  return json(
    await fetch(`${API_BASE}/api/rag/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId, question }),
    }),
  )
}

export async function reindexRag(groupId: string): Promise<{ docs: number; chunks: number }> {
  return json(
    await fetch(`${API_BASE}/api/rag/reindex?group=${encodeURIComponent(groupId)}`, {
      method: 'POST',
    }),
  )
}

// Agent: generate a deliverable from records + direction.
export type AgentMode =
  | 'meeting_summary'
  | 'decisions'
  | 'action_plan'
  | 'ppt_draft'
  | 'task_draft'
  | 'prd'
  | 'report'
  | 'plan'
  | 'design'
  | 'dev'

export type AgentSkill = {
  id: string
  label: string
  purpose: string
  instructions: string[]
}

export type AgentArtifact = {
  title: string
  content: string
  sources: string[]
  selectedSkills: AgentSkill[]
  mode: AgentMode
  status: 'draft' | 'ready_for_approval' | 'completed'
  artifactId?: string
  nextAction?: string
}

export type MeetingStructure = {
  title: string
  summary: string
  decisions: Array<{
    decision: string
    owner?: string
    dueDate?: string
    evidence?: string
    confidence?: 'high' | 'medium' | 'low'
    needsReview?: boolean
  }>
  actionItems: Array<{
    task: string
    owner?: string
    dueDate?: string
    priority?: 'P0' | 'P1' | 'P2'
    doneDefinition?: string
    evidence?: string
    needsReview?: boolean
  }>
  unresolved: Array<{ item: string; owner?: string; dueDate?: string; reason?: string }>
  requestedArtifacts: Array<{ type: 'notion' | 'jira' | 'ppt' | 'pdf' | 'other'; audience?: string; purpose?: string; notes?: string }>
  risks: string[]
  sources: string[]
  selectedSkills: AgentSkill[]
}

export async function listAgentSkills(): Promise<{ skills: AgentSkill[] }> {
  return json(await fetch(`${API_BASE}/api/agent/skills`))
}

export async function runAgent(
  groupId: string,
  mode: AgentMode,
  direction: string,
  meetingTranscript = '',
): Promise<AgentArtifact> {
  return json(
    await fetch(`${API_BASE}/api/agent/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId, mode, direction, meetingTranscript }),
    }),
  )
}

export async function planAgent(
  groupId: string,
  direction: string,
  meetingTranscript = '',
): Promise<AgentArtifact> {
  return json(
    await fetch(`${API_BASE}/api/agent/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId, direction, meetingTranscript }),
    }),
  )
}

export async function proceedAgent(opts: {
  groupId: string
  direction: string
  meetingTranscript?: string
  executionPlan?: string
  mode?: AgentMode
}): Promise<AgentArtifact> {
  return json(
    await fetch(`${API_BASE}/api/agent/proceed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...opts,
        approved: true,
        mode: opts.mode ?? 'ppt_draft',
      }),
    }),
  )
}

export async function structureMeeting(
  groupId: string,
  direction: string,
  meetingTranscript: string,
): Promise<MeetingStructure> {
  return json(
    await fetch(`${API_BASE}/api/meetings/structure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId, direction, meetingTranscript }),
    }),
  )
}
