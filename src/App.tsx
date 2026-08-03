import { useState } from 'react'
import { JoinScreen } from './components/JoinScreen'
import { RoomView } from './components/RoomView'
import { API_BASE } from './lib/api'

const serverUrl =
  (import.meta.env.VITE_LIVEKIT_URL as string | undefined) ??
  'wss://ms-hack-ly6rx40h.livekit.cloud'

export default function App() {
  const [session, setSession] = useState<{
    token: string
    code: string
    name: string
    lang: string
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const join = async ({ code, name, lang }: { code: string; name: string; lang: string }) => {
    setError('')
    setBusy(true)
    try {
      const res = await fetch(
        `${API_BASE}/api/token?room=${encodeURIComponent(code)}&identity=${encodeURIComponent(name)}`,
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'token error')
      if (!serverUrl) throw new Error('VITE_LIVEKIT_URL not set in .env.local')
      setSession({ token: data.token, code, name, lang })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (session) {
    return (
      <RoomView
        serverUrl={serverUrl!}
        token={session.token}
        code={session.code}
        name={session.name}
        lang={session.lang}
        onLeave={() => setSession(null)}
      />
    )
  }

  return <JoinScreen onJoin={join} busy={busy} error={error} />
}
