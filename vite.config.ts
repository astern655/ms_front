import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Backend (token + STT) runs as a separate service — see VITE_API_BASE in .env.local.
export default defineConfig({
  plugins: [react()],
})
