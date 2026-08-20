import { HandLandmarker, FilesetResolver, type NormalizedLandmark } from '@mediapipe/tasks-vision'
import type { Room } from 'livekit-client'
import { encodeCaption, type TranscriptEntry } from './caption'

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
const MODEL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

// Small demo vocabulary. Each entry: finger pattern [thumb, index, middle, ring, pinky]
// mapped to a bilingual phrase. Client-side only — no server/STT needed.
type Gesture = {
  id: string
  pattern: [boolean, boolean, boolean, boolean, boolean]
  emoji: string
  ko: string
  en: string
}
const GESTURES: Gesture[] = [
  { id: 'open', pattern: [true, true, true, true, true], emoji: '✋', ko: '안녕하세요', en: 'Hello' },
  { id: 'fist', pattern: [false, false, false, false, false], emoji: '✊', ko: '아니요', en: 'No' },
  { id: 'thumb', pattern: [true, false, false, false, false], emoji: '👍', ko: '좋아요', en: 'Good' },
  { id: 'v', pattern: [false, true, true, false, false], emoji: '✌️', ko: '반가워요', en: 'Nice to meet you' },
  { id: 'point', pattern: [false, true, false, false, false], emoji: '☝️', ko: '저기요', en: 'Excuse me' },
  { id: 'call', pattern: [true, false, false, false, true], emoji: '🤙', ko: '통화해요', en: "Let's call" },
  { id: 'ily', pattern: [true, true, false, false, true], emoji: '🤟', ko: '사랑해요', en: 'I love you' },
]

// Legend for the UI so a user knows which hand shapes produce which phrase.
export const SIGN_GLOSSARY = GESTURES.map((g) => ({ emoji: g.emoji, ko: g.ko, en: g.en }))

const dist = (a: NormalizedLandmark, b: NormalizedLandmark) => Math.hypot(a.x - b.x, a.y - b.y)

// Rough "is this finger extended?" heuristic from 21 hand landmarks.
function fingerPattern(lm: NormalizedLandmark[]): [boolean, boolean, boolean, boolean, boolean] {
  const ext = (tip: number, pip: number) => lm[tip].y < lm[pip].y - 0.02
  const thumb = dist(lm[4], lm[9]) > dist(lm[2], lm[9]) * 1.3
  return [thumb, ext(8, 6), ext(12, 10), ext(16, 14), ext(20, 18)]
}

function classify(lm: NormalizedLandmark[]): Gesture | null {
  const p = fingerPattern(lm)
  return GESTURES.find((g) => g.pattern.every((v, i) => v === p[i])) ?? null
}

export type SignStatus = { ready: boolean; hand: boolean; label: string | null }

export function startSign(
  room: Room,
  opts: {
    speaker: string
    sourceLang: string
    onEntry: (e: TranscriptEntry) => void
    onStatus?: (s: SignStatus) => void
    videoEl?: HTMLVideoElement | null
  },
): () => void {
  let stopped = false
  let raf = 0
  let stream: MediaStream | undefined
  let landmarker: HandLandmarker | undefined
  // Use the caller-provided <video> (shown as a preview) when available, else a detached one.
  const video = opts.videoEl ?? document.createElement('video')
  video.autoplay = true
  video.muted = true
  video.playsInline = true
  const status = (s: SignStatus) => opts.onStatus?.(s)

  // Debounce: require a gesture to hold, and don't repeat too fast.
  let candidate: string | null = null
  let holdFrames = 0
  let lastEmit = 0

  const emit = (g: Gesture) => {
    const entry: TranscriptEntry = {
      id: crypto.randomUUID(),
      speaker: opts.speaker,
      kind: 'sign',
      sourceLang: opts.sourceLang,
      sourceText: g.ko,
      translations: { ko: g.ko, en: g.en },
      ts: Date.now(),
    }
    try {
      room.localParticipant.publishData(Uint8Array.from(encodeCaption(entry)), {
        reliable: true,
        topic: 'caption',
      })
    } catch {
      /* not connected yet — still show locally */
    }
    opts.onEntry(entry)
  }

  ;(async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks(WASM)
      landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL },
        numHands: 1,
        runningMode: 'VIDEO',
      })
      stream = await navigator.mediaDevices.getUserMedia({ video: { width: 480, height: 360 } })
      if (stopped) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      video.srcObject = stream
      await video.play().catch(() => {})
      status({ ready: true, hand: false, label: null })

      const loop = () => {
        if (stopped || !landmarker) return
        if (video.readyState >= 2) {
          const res = landmarker.detectForVideo(video, performance.now())
          const hand = res.landmarks?.[0]
          const g = hand ? classify(hand) : null
          // Live feedback: is a hand seen, and which gesture is recognized right now.
          status({
            ready: true,
            hand: !!hand,
            label: g ? (opts.sourceLang === 'en' ? g.en : g.ko) : null,
          })
          if (g) {
            if (g.id === candidate) holdFrames += 1
            else {
              candidate = g.id
              holdFrames = 1
            }
            const now = Date.now()
            if (holdFrames >= 4 && now - lastEmit > 1800) {
              lastEmit = now
              holdFrames = 0
              emit(g)
            }
          } else {
            candidate = null
            holdFrames = 0
          }
        }
        raf = requestAnimationFrame(loop)
      }
      loop()
    } catch {
      /* MediaPipe/model/camera unavailable — sign mode simply stays idle */
      status({ ready: false, hand: false, label: null })
    }
  })()

  return () => {
    stopped = true
    cancelAnimationFrame(raf)
    stream?.getTracks().forEach((t) => t.stop())
    landmarker?.close()
  }
}
