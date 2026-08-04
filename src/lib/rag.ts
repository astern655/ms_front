import { API_BASE } from './api'

export async function askRag(
  groupId: string,
  question: string,
): Promise<{ answer: string; sources: string[] }> {
  const res = await fetch(`${API_BASE}/api/rag/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ groupId, question }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'ask failed')
  return data
}

export async function reindexRag(groupId: string): Promise<{ docs: number; chunks: number }> {
  const res = await fetch(`${API_BASE}/api/rag/reindex?group=${encodeURIComponent(groupId)}`, {
    method: 'POST',
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'reindex failed')
  return data
}
