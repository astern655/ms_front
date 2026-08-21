import type { Room } from 'livekit-client'
import { encodeCaption, type TranscriptEntry } from './caption'
import { apiFetch } from '../../lib/api'

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
  // 4s balances latency vs. context. Recording and STT no longer block each other (see onstop),
  // so chunks stay back-to-back with no audio gap.
  const chunkMs = opts.chunkMs ?? 4000
  // Skip near-silent chunks: transcribing silence/noise makes the model hallucinate
  // phrases (often in a random language). Real speech is well above this size.
  const MIN_BYTES = 4000
  let stopped = false
  let recorder: MediaRecorder | undefined
  let stream: MediaStream | undefined

  const send = async (blob: Blob) => {
    try {
      const res = await apiFetch(
        `/api/stt?sourceLang=${opts.sourceLang}&targetLangs=${opts.targetLangs.join(',')}`,
        { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: blob },
        // If the primary STT backend hangs (>9s), fall back to the secondary so captions
        // keep flowing instead of silently stalling.
        9000,
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
      // topic 'caption' keeps this separate from LiveKit chat data.
      room.localParticipant.publishData(Uint8Array.from(encodeCaption(entry)), {
        reliable: true,
        topic: 'caption',
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
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' })
        // Fire STT without awaiting so the next chunk records immediately — no gap in
        // audio and no added latency while the previous chunk transcribes.
        if (!stopped && blob.size > MIN_BYTES) void send(blob)
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
