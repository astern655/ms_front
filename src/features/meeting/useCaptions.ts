import { useEffect, useState } from 'react'
import { RoomEvent, type Room } from 'livekit-client'
import { decodeCaption, type TranscriptEntry } from './caption'
import { startMic } from './mic'
import { startSign, type SignStatus } from './sign'

// Collects the full caption log for a room: my mic (STT via OpenAI) + everyone
// else's caption/sign data. Shared by the overlay and the chat feed.
// STT runs through the LLM backend (/api/stt). Set VITE_STT_ENABLED=0 to disable.
const STT_ENABLED = import.meta.env.VITE_STT_ENABLED !== '0'

export function useCaptions(
  room: Room,
  opts: {
    speaker: string
    sourceLang: string
    targetLangs: string[]
    signEnabled?: boolean
    signVideoEl?: HTMLVideoElement | null
    onSignStatus?: (s: SignStatus) => void
  },
): TranscriptEntry[] {
  const [entries, setEntries] = useState<TranscriptEntry[]>([])
  const { speaker, sourceLang, signEnabled, signVideoEl, onSignStatus } = opts
  const targetKey = opts.targetLangs.join(',')

  // Sign-language input (client-side hand tracking → caption). Toggled at runtime.
  useEffect(() => {
    if (!signEnabled) return
    const stop = startSign(room, {
      speaker,
      sourceLang,
      onEntry: (e) => setEntries((prev) => [...prev, e]),
      onStatus: onSignStatus,
      videoEl: signVideoEl,
    })
    return stop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, signEnabled, speaker, sourceLang, signVideoEl])

  useEffect(() => {
    const onData = (payload: Uint8Array, _p?: unknown, _k?: unknown, topic?: string) => {
      if (topic !== 'caption') return
      setEntries((prev) => [...prev, decodeCaption(payload)])
    }
    room.on(RoomEvent.DataReceived, onData)
    const stop = STT_ENABLED
      ? startMic(room, {
          speaker,
          sourceLang,
          targetLangs: targetKey.split(','),
          onEntry: (e) => setEntries((prev) => [...prev, e]),
        })
      : () => {}
    return () => {
      room.off(RoomEvent.DataReceived, onData)
      stop()
    }
  }, [room, speaker, sourceLang, targetKey])

  return entries
}
