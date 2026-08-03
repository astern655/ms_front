import { useState, type ReactNode } from 'react'
import '@livekit/components-styles'
import {
  LiveKitRoom,
  RoomAudioRenderer,
  GridLayout,
  ParticipantTile,
  useTracks,
  useTrackToggle,
  useRoomContext,
} from '@livekit/components-react'
import { Track } from 'livekit-client'
import { Captions } from './Captions'
import {
  MicIcon,
  MicOffIcon,
  VideoIcon,
  VideoOffIcon,
  ScreenIcon,
  LeaveIcon,
  CopyIcon,
  CheckIcon,
} from './icons'

function Stage() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  )
  return (
    <GridLayout tracks={tracks}>
      <ParticipantTile />
    </GridLayout>
  )
}

function Toggle({
  source,
  on,
  off,
  label,
}: {
  source: Track.Source.Microphone | Track.Source.Camera | Track.Source.ScreenShare
  on: ReactNode
  off: ReactNode
  label: string
}) {
  const { enabled, pending, toggle } = useTrackToggle({ source })
  return (
    <button
      className={`ctrl ${enabled ? 'ctrl-on' : 'ctrl-off'}`}
      onClick={() => toggle()}
      disabled={pending}
      aria-pressed={enabled}
      aria-label={label}
      title={label}
    >
      {enabled ? on : off}
    </button>
  )
}

function LeaveButton() {
  const room = useRoomContext()
  return (
    <button
      className="ctrl ctrl-leave"
      onClick={() => room.disconnect()}
      aria-label="나가기"
      title="나가기"
    >
      <LeaveIcon />
    </button>
  )
}

function CodePill({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }
  return (
    <div className="glass code-pill">
      <span className="subtitle">코드</span>
      <b>{code}</b>
      <button className="icon-btn small" onClick={copy} aria-label="코드 복사">
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
    </div>
  )
}

export function RoomView({
  serverUrl,
  token,
  code,
  name,
  lang,
  onLeave,
}: {
  serverUrl: string
  token: string
  code: string
  name: string
  lang: string
  onLeave: () => void
}) {
  return (
    <LiveKitRoom
      className="room"
      token={token}
      serverUrl={serverUrl}
      connect
      video
      audio
      onDisconnected={onLeave}
    >
      <RoomAudioRenderer />
      <Stage />
      <CodePill code={code} />
      <Captions
        speaker={name}
        sourceLang={lang}
        displayLang={lang}
        targetLangs={['ko', 'en']}
      />
      <div className="glass controlbar">
        <Toggle
          source={Track.Source.Microphone}
          on={<MicIcon />}
          off={<MicOffIcon />}
          label="마이크"
        />
        <Toggle
          source={Track.Source.Camera}
          on={<VideoIcon />}
          off={<VideoOffIcon />}
          label="카메라"
        />
        <Toggle
          source={Track.Source.ScreenShare}
          on={<ScreenIcon />}
          off={<ScreenIcon />}
          label="화면 공유"
        />
        <LeaveButton />
      </div>
    </LiveKitRoom>
  )
}
