// Base URL of the separate backend service (token + STT).
// Set VITE_API_BASE in .env.local; defaults to the local backend dev port.
export const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://localhost:3001'
