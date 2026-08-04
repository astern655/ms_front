import { useEffect, useState } from 'react'
import { RoomEvent, type Room } from 'livekit-client'
import { decodeCaption, type TranscriptEntry } from './caption'
import { startMic } from './mic'

// Collects the full caption log for a room: my mic (STT) + everyone else's
// caption data. Shared by the overlay and the chat feed.
export function useCaptions(
  room: Room,
  opts: { speaker: string; sourceLang: string; targetLangs: string[] },
): TranscriptEntry[] {
  const [entries, setEntries] = useState<TranscriptEntry[]>([])
  const { speaker, sourceLang } = opts
  const targetKey = opts.targetLangs.join(',')

  useEffect(() => {
    const onData = (payload: Uint8Array, _p?: unknown, _k?: unknown, topic?: string) => {
      if (topic !== 'caption') return
      setEntries((prev) => [...prev, decodeCaption(payload)])
    }
    room.on(RoomEvent.DataReceived, onData)
    const stop = startMic(room, {
      speaker,
      sourceLang,
      targetLangs: targetKey.split(','),
      onEntry: (e) => setEntries((prev) => [...prev, e]),
    })
    return () => {
      room.off(RoomEvent.DataReceived, onData)
      stop()
    }
  }, [room, speaker, sourceLang, targetKey])

  return entries
}
