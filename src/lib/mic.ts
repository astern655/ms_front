import type { Room } from 'livekit-client'
import { encodeCaption, type TranscriptEntry } from './caption'
import { API_BASE } from './api'

// Records the local mic in fixed chunks, sends each to /api/stt, then broadcasts
// the resulting caption to the room and reports it locally via onEntry.
// Each chunk is a self-contained webm recording so OpenAI can transcribe it standalone.
export function startMic(
  room: Room,
  opts: {
    speaker: string
    sourceLang: string
    targetLangs: string[]
    onEntry: (e: TranscriptEntry) => void
    chunkMs?: number
  },
): () => void {
  const chunkMs = opts.chunkMs ?? 4000
  let stopped = false
  let recorder: MediaRecorder | undefined
  let stream: MediaStream | undefined

  const send = async (blob: Blob) => {
    try {
      const res = await fetch(
        `${API_BASE}/api/stt?sourceLang=${opts.sourceLang}&targetLangs=${opts.targetLangs.join(',')}`,
        { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: blob },
      )
      if (!res.ok) return
      const { sourceText, translations } = await res.json()
      if (!sourceText?.trim()) return
      const entry: TranscriptEntry = {
        id: crypto.randomUUID(),
        speaker: opts.speaker,
        kind: 'speech',
        sourceLang: opts.sourceLang,
        sourceText,
        translations,
        ts: Date.now(),
      }
      // Copy into an ArrayBuffer-backed view to satisfy publishData's type.
      room.localParticipant.publishData(Uint8Array.from(encodeCaption(entry)), {
        reliable: true,
      })
      opts.onEntry(entry)
    } catch {
      /* transient network/STT error: drop this chunk, keep listening */
    }
  }

  navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => {
    stream = s
    if (stopped) {
      s.getTracks().forEach((t) => t.stop())
      return
    }
    const cycle = () => {
      if (stopped) return
      const chunks: Blob[] = []
      recorder = new MediaRecorder(s, { mimeType: 'audio/webm' })
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data)
      }
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' })
        if (!stopped && blob.size > 1200) await send(blob)
        cycle()
      }
      recorder.start()
      setTimeout(() => {
        if (recorder && recorder.state !== 'inactive') recorder.stop()
      }, chunkMs)
    }
    cycle()
  })

  return () => {
    stopped = true
    try {
      recorder?.stop()
    } catch {
      /* already stopped */
    }
    stream?.getTracks().forEach((t) => t.stop())
  }
}
