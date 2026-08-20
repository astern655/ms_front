// Backend service base (token + STT + RAG + host controls).
// Primary = the Render deployment (CORS already configured). If it is unreachable
// (network / CORS error, not an HTTP error), requests fall back to our self-hosted backend.
const RENDER = 'https://ms-backend-fzyq.onrender.com'
const SELF_HOSTED = 'https://api-1-201-116-28.sslip.io'

// Override either with env (VITE_API_BASE primary, VITE_API_FALLBACK secondary).
export const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? RENDER
const API_FALLBACK = (import.meta.env.VITE_API_FALLBACK as string | undefined) ?? SELF_HOSTED

// Fetch against the primary backend; on a connection/CORS failure (fetch throws), retry the
// same request against the fallback backend. An HTTP error (e.g. 500) does NOT trigger a
// fallback — the backend was reachable, so the caller handles the status.
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(API_BASE + path, init)
  } catch (err) {
    if (API_FALLBACK && API_FALLBACK !== API_BASE) {
      return await fetch(API_FALLBACK + path, init)
    }
    throw err
  }
}
