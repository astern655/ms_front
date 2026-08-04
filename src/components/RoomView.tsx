import { useEffect, useState, type ReactNode } from 'react'
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
import { RoomEvent, Track, type RemoteAudioTrack } from 'livekit-client'
import { Captions } from './Captions'
import { SettingsSheet } from './SettingsSheet'
import { ChatPanel } from './ChatPanel'
import { useLocalMic } from '../lib/useLocalMic'
import {
  MicIcon,
  MicOffIcon,
  VideoIcon,
  VideoOffIcon,
  ScreenIcon,
  LeaveIcon,
  CopyIcon,
  CheckIcon,
  SettingsIcon,
  ChatIcon,
} from './icons'

function Stage() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  )
  const screens = tracks.filter((t) => t.source === Track.Source.ScreenShare)
  const cams = tracks.filter((t) => t.source === Track.Source.Camera)

  // Screen share spotlight (our layout): big shared screen + camera thumbnails.
  if (screens.length > 0) {
    return (
      <div className="stage-spotlight">
        <div className="spot-main">
          <ParticipantTile trackRef={screens[0]} />
        </div>
        <div className="spot-strip">
          {cams.map((t) => (
            <ParticipantTile key={`${t.participant.identity}-cam`} trackRef={t} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <GridLayout tracks={cams}>
      <ParticipantTile />
    </GridLayout>
  )
}

// Applies a master output volume (0..1) to all remote audio tracks.
function useSpeakerVolume(volume: number) {
  const room = useRoomContext()
  useEffect(() => {
    const apply = () => {
      room.remoteParticipants.forEach((p) =>
        p.audioTrackPublications.forEach((pub) =>
          (pub.track as RemoteAudioTrack | undefined)?.setVolume(volume),
        ),
      )
    }
    apply()
    room.on(RoomEvent.TrackSubscribed, apply)
    return () => {
      room.off(RoomEvent.TrackSubscribed, apply)
    }
  }, [room, volume])
}

function Toggle({
  source,
  on,
  off,
  label,
}: {
  source: Track.Source.Camera | Track.Source.ScreenShare
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

function RoomInner({
  code,
  name,
  lang,
}: {
  code: string
  name: string
  lang: string
}) {
  const room = useRoomContext()
  const [micDeviceId, setMicDeviceId] = useState<string | undefined>(undefined)
  const [speakerVolume, setSpeakerVolume] = useState(100)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)

  const mic = useLocalMic(room, micDeviceId)
  useSpeakerVolume(speakerVolume / 100)

  return (
    <>
      <Stage />
      <CodePill code={code} />
      <Captions speaker={name} sourceLang={lang} displayLang={lang} targetLangs={['ko', 'en']} />

      <div className="glass controlbar">
        <button
          className={`ctrl ${mic.muted ? 'ctrl-off' : 'ctrl-on'}`}
          onClick={mic.toggleMute}
          aria-pressed={!mic.muted}
          aria-label="마이크"
          title="마이크"
        >
          {mic.muted ? <MicOffIcon /> : <MicIcon />}
        </button>
        <Toggle source={Track.Source.Camera} on={<VideoIcon />} off={<VideoOffIcon />} label="카메라" />
        <Toggle source={Track.Source.ScreenShare} on={<ScreenIcon />} off={<ScreenIcon />} label="화면 공유" />
        <button
          className={`ctrl ${settingsOpen ? 'ctrl-on' : 'ctrl-off'}`}
          onClick={() => setSettingsOpen((v) => !v)}
          aria-label="설정"
          title="설정"
        >
          <SettingsIcon />
        </button>
        <button
          className={`ctrl ${chatOpen ? 'ctrl-on' : 'ctrl-off'}`}
          onClick={() => setChatOpen((v) => !v)}
          aria-label="채팅"
          title="채팅"
        >
          <ChatIcon />
        </button>
        <button className="ctrl ctrl-leave" onClick={() => room.disconnect()} aria-label="나가기" title="나가기">
          <LeaveIcon />
        </button>
      </div>

      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        micDeviceId={micDeviceId}
        setMicDeviceId={setMicDeviceId}
        setGain={mic.setGain}
        levelRef={mic.levelRef}
        speakerVolume={speakerVolume}
        setSpeakerVolume={setSpeakerVolume}
      />
    </>
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
      audio={false}
      onDisconnected={onLeave}
    >
      <RoomAudioRenderer />
      <RoomInner code={code} name={name} lang={lang} />
    </LiveKitRoom>
  )
}
