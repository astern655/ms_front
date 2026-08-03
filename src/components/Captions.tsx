import { useEffect, useState, useCallback } from 'react'
import { useRoomContext } from '@livekit/components-react'
import { RoomEvent } from 'livekit-client'
import { decodeCaption, type TranscriptEntry } from '../lib/caption'
import { startMic } from '../lib/mic'

export function Captions({
  speaker,
  sourceLang,
  displayLang,
  targetLangs,
}: {
  speaker: string
  sourceLang: string
  displayLang: string
  targetLangs: string[]
}) {
  const room = useRoomContext()
  const [items, setItems] = useState<TranscriptEntry[]>([])

  const push = useCallback((e: TranscriptEntry) => {
    setItems((prev) => [...prev.slice(-3), e])
  }, [])

  useEffect(() => {
    const onData = (payload: Uint8Array) => push(decodeCaption(payload))
    room.on(RoomEvent.DataReceived, onData)
    const stop = startMic(room, { speaker, sourceLang, targetLangs, onEntry: push })
    return () => {
      room.off(RoomEvent.DataReceived, onData)
      stop()
    }
  }, [room, speaker, sourceLang, targetLangs, push])

  if (items.length === 0) return null
  return (
    <div className="captions">
      {items.map((e) => (
        <div key={e.id} className="glass caption">
          <b>{e.speaker}{e.kind === 'sign' ? ' ✋' : ''}</b>
          {e.translations[displayLang] || e.sourceText}
        </div>
      ))}
    </div>
  )
}
