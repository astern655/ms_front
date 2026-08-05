import { API_BASE } from './api'

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
export type AgentMode = 'prd' | 'report' | 'plan' | 'design' | 'dev'

export async function runAgent(
  groupId: string,
  mode: AgentMode,
  direction: string,
): Promise<{ title: string; content: string; sources: string[] }> {
  return json(
    await fetch(`${API_BASE}/api/agent/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId, mode, direction }),
    }),
  )
}
