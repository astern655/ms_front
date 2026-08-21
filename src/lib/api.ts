// Backend service base (token + STT + RAG + host controls).
// Primary = the Render deployment. If it is unreachable OR too slow (see timeoutMs),
// requests fall back to our self-hosted backend.
const RENDER = 'https://ms-backend-fzyq.onrender.com'
const SELF_HOSTED = 'https://api-1-201-116-28.sslip.io'

// Override either with env (VITE_API_BASE primary, VITE_API_FALLBACK secondary).
export const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? RENDER
const API_FALLBACK = (import.meta.env.VITE_API_FALLBACK as string | undefined) ?? SELF_HOSTED

// Fetch against the primary backend; on a connection/CORS failure OR a timeout (when
// timeoutMs is given), retry the same request against the fallback backend. A plain HTTP
// error (e.g. 500) does NOT trigger a fallback — the backend was reachable.
export async function apiFetch(
  path: string,
  init?: RequestInit,
  timeoutMs?: number,
): Promise<Response> {
  const run = (base: string) => {
    if (!timeoutMs) return fetch(base + path, init)
    const ctrl = new AbortController()
    const id = setTimeout(() => ctrl.abort(), timeoutMs)
    return fetch(base + path, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(id))
  }
  try {
    return await run(API_BASE)
  } catch (err) {
    if (API_FALLBACK && API_FALLBACK !== API_BASE) return await run(API_FALLBACK)
    throw err
  }
}
