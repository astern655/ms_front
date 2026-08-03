// Base URL of the separate backend service (token + STT).
// Override with VITE_API_BASE (e.g. http://localhost:3001 locally); defaults to the deployed backend.
export const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined) ?? 'https://ms-backend-fzyq.onrender.com'
