import { useEffect, useState, type ReactNode, type MouseEvent as ReactMouseEvent } from 'react'
import '@livekit/components-styles'
import {
  LiveKitRoom,
  RoomAudioRenderer,
  GridLayout,
  ParticipantTile,
  useTracks,
  useTrackToggle,
  useRoomContext,
  useParticipants,
} from '@livekit/components-react'
import { RoomEvent, Track, type RemoteAudioTrack } from 'livekit-client'
import { Captions } from './Captions'
import { SettingsSheet } from './SettingsSheet'
import { ChatFeed } from './ChatPanel'
import { DocsView } from './DocsView'
import { useLocalMic } from '../lib/useLocalMic'
import { useCaptions } from '../lib/useCaptions'
import {
  MicIcon,
  MicOffIcon,
  VideoIcon,
  VideoOffIcon,
  ScreenIcon,
  LeaveIcon,
  SettingsIcon,
  ChatIcon,
  PeopleIcon,
  CloseIcon,
  DocIcon,
} from './icons'

function ParticipantsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const participants = useParticipants()
  if (!open) return null
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="glass sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="참가자">
        <div className="sheet-grabber" />
        <div className="sheet-head">
          <h2>참가자 {participants.length}</h2>
          <button className="icon-btn small" onClick={onClose} aria-label="닫기">
            <CloseIcon />
          </button>
        </div>
        <div className="roster">
          {participants.map((p) => (
            <div key={p.identity} className="roster-item">
              <span className="roster-name">
                {p.name || p.identity}
                {p.isLocal ? ' (나)' : ''}
              </span>
              <span className={`roster-mic ${p.isMicrophoneEnabled ? 'on' : 'off'}`}>
                {p.isMicrophoneEnabled ? <MicIcon /> : <MicOffIcon />}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

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

function RoomInner({
  name,
  lang,
  groupId,
}: {
  name: string
  lang: string
  groupId: string
}) {
  const room = useRoomContext()
  const [micDeviceId, setMicDeviceId] = useState<string | undefined>(undefined)
  const [speakerVolume, setSpeakerVolume] = useState(100)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [peopleOpen, setPeopleOpen] = useState(false)
  const [panel, setPanel] = useState<'chat' | 'docs' | null>(null)
  const togglePanel = (p: 'chat' | 'docs') => setPanel((cur) => (cur === p ? null : p))
  const [dockWidth, setDockWidth] = useState(400)
  const startResize = (e: ReactMouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = dockWidth
    const onMove = (ev: MouseEvent) =>
      setDockWidth(Math.min(900, Math.max(300, startW + (startX - ev.clientX))))
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const mic = useLocalMic(room, micDeviceId)
  useSpeakerVolume(speakerVolume / 100)
  const captions = useCaptions(room, { speaker: name, sourceLang: lang, targetLangs: ['ko', 'en'] })

  return (
    <>
      <div className="stage-area">
        <Stage />
        <Captions entries={captions} displayLang={lang} />

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
            className={`ctrl ${panel === 'chat' ? 'ctrl-on' : 'ctrl-off'}`}
            onClick={() => togglePanel('chat')}
            aria-label="채팅·자막"
            title="채팅·자막"
          >
            <ChatIcon />
          </button>
          <button
            className={`ctrl ${peopleOpen ? 'ctrl-on' : 'ctrl-off'}`}
            onClick={() => setPeopleOpen((v) => !v)}
            aria-label="참가자"
            title="참가자"
          >
            <PeopleIcon />
          </button>
          <button
            className={`ctrl ${panel === 'docs' ? 'ctrl-on' : 'ctrl-off'}`}
            onClick={() => togglePanel('docs')}
            aria-label="문서"
            title="문서"
          >
            <DocIcon />
          </button>
          <button className="ctrl ctrl-leave" onClick={() => room.disconnect()} aria-label="나가기" title="나가기">
            <LeaveIcon />
          </button>
        </div>
      </div>

      {panel && (
        <div className="dock" style={{ width: dockWidth }}>
          <div className="dock-resize" onMouseDown={startResize} title="드래그로 크기 조절" />
          <div className="dock-tabs">
            <button className={panel === 'chat' ? 'on' : ''} onClick={() => setPanel('chat')}>
              채팅·자막
            </button>
            <button className={panel === 'docs' ? 'on' : ''} onClick={() => setPanel('docs')}>
              문서
            </button>
            <button className="icon-btn small dock-close" onClick={() => setPanel(null)} aria-label="닫기">
              <CloseIcon />
            </button>
          </div>
          <div className="dock-body">
            {panel === 'chat' && <ChatFeed captions={captions} displayLang={lang} myName={name} />}
            {panel === 'docs' && <DocsView groupId={groupId} />}
          </div>
        </div>
      )}

      <ParticipantsSheet open={peopleOpen} onClose={() => setPeopleOpen(false)} />
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
  name,
  lang,
  groupId,
  onLeave,
}: {
  serverUrl: string
  token: string
  name: string
  lang: string
  groupId: string
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
      <RoomInner name={name} lang={lang} groupId={groupId} />
    </LiveKitRoom>
  )
}
