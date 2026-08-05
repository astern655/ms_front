import { API_BASE } from './api'

export type AgentSkills = {
  docs_rag: boolean
  summarize: boolean
  action_items: boolean
  translate: boolean
}
export type Agent = { name: string; system_prompt: string; skills: AgentSkills }
export type SessionMsg = { role: 'user' | 'ai'; content: string; sources: string[] | null }

async function json<T>(res: Response): Promise<T> {
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'request failed')
  return data as T
}

export async function loadAgent(
  groupId: string,
  teamId: string | null,
): Promise<{ agent: Agent; messages: SessionMsg[] }> {
  const q = `group=${encodeURIComponent(groupId)}${teamId ? `&team=${encodeURIComponent(teamId)}` : ''}`
  return json(await fetch(`${API_BASE}/api/agent?${q}`))
}

export async function saveAgentConfig(
  groupId: string,
  fields: { name?: string; systemPrompt?: string; skills?: AgentSkills },
): Promise<void> {
  await json(
    await fetch(`${API_BASE}/api/agent/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId, ...fields }),
    }),
  )
}

export async function askAgent(
  groupId: string,
  teamId: string | null,
  question: string,
): Promise<{ answer: string; sources: string[] }> {
  return json(
    await fetch(`${API_BASE}/api/agent/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId, teamId, question }),
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
