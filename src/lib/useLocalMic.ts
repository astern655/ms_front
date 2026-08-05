import { useEffect, useRef, useState } from 'react'
import { LocalAudioTrack, Track, type Room } from 'livekit-client'

// Publishes the local mic through a Web Audio gain node so "mic volume" actually
// changes the transmitted level. Also exposes a live input level (0..1) for a meter.
// LiveKitRoom must be mounted with audio={false} so it doesn't also publish the raw mic.
export function useLocalMic(room: Room, deviceId?: string, startMuted = false) {
  const [muted, setMuted] = useState(startMuted)
  const gainNodeRef = useRef<GainNode | null>(null)
  const trackRef = useRef<LocalAudioTrack | null>(null)
  const levelRef = useRef(0)

  useEffect(() => {
    let cancelled = false
    let ctx: AudioContext | undefined
    let raw: MediaStream | undefined
    let raf = 0

    ;(async () => {
      raw = await navigator.mediaDevices.getUserMedia({
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      })
      if (cancelled) {
        raw.getTracks().forEach((t) => t.stop())
        return
      }
      ctx = new AudioContext()
      if (ctx.state === 'suspended') await ctx.resume()
      const src = ctx.createMediaStreamSource(raw)
      const gain = ctx.createGain()
      gain.gain.value = 1
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      const dest = ctx.createMediaStreamDestination()
      src.connect(gain)
      gain.connect(analyser)
      gain.connect(dest)
      gainNodeRef.current = gain

      const track = new LocalAudioTrack(dest.stream.getAudioTracks()[0])
      await room.localParticipant.publishTrack(track, { source: Track.Source.Microphone })
      if (startMuted) await track.mute()
      trackRef.current = track

      const buf = new Uint8Array(analyser.fftSize)
      const tick = () => {
        analyser.getByteTimeDomainData(buf)
        let sum = 0
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128
          sum += v * v
        }
        levelRef.current = Math.min(1, Math.sqrt(sum / buf.length) * 3)
        raf = requestAnimationFrame(tick)
      }
      tick()
    })()

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      const t = trackRef.current
      if (t) {
        room.localParticipant.unpublishTrack(t)
        t.stop()
      }
      trackRef.current = null
      gainNodeRef.current = null
      ctx?.close()
      raw?.getTracks().forEach((t) => t.stop())
    }
  }, [room, deviceId])

  const setGain = (value: number) => {
    if (gainNodeRef.current) gainNodeRef.current.gain.value = value
  }

  const toggleMute = async () => {
    const t = trackRef.current
    if (!t) return
    if (muted) {
      await t.unmute()
      setMuted(false)
    } else {
      await t.mute()
      setMuted(true)
    }
  }

  return { muted, toggleMute, setGain, levelRef }
}
