import { useEffect, useRef, useState, type ReactNode, type MouseEvent as ReactMouseEvent } from 'react'
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
  useLocalParticipant,
} from '@livekit/components-react'
import { RoomEvent, Track, type RemoteAudioTrack, type LocalVideoTrack } from 'livekit-client'
import { BackgroundBlur } from '@livekit/track-processors'
import { Captions } from './Captions'
import { WaitingRoom } from './WaitingRoom'
import { API_BASE } from '../../lib/api'
import { useT } from '../../lib/i18n'
import { SettingsSheet } from './SettingsSheet'
import { ChatFeed } from './ChatPanel'
import { DocsView } from '../docs/DocsView'
import { useLocalMic } from './useLocalMic'
import { useCaptions } from './useCaptions'
import type { SignStatus } from './sign'
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
  SignIcon,
  BlurIcon,
} from '../../components/ui/icons'

function ParticipantsSheet({
  open,
  onClose,
  canHost = false,
  room,
}: {
  open: boolean
  onClose: () => void
  canHost?: boolean
  room?: string
}) {
  const t = useT()
  const participants = useParticipants()
  const hostAction = (action: 'mute' | 'remove', identity: string) => {
    if (!room) return
    fetch(`${API_BASE}/api/room/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room, identity }),
    }).catch(() => {})
  }
  if (!open) return null
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="glass sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t('참가자', 'Participants')}>
        <div className="sheet-grabber" />
        <div className="sheet-head">
          <h2>{t('참가자', 'Participants')} {participants.length}</h2>
          <button className="icon-btn small" onClick={onClose} aria-label={t('닫기', 'Close')}>
            <CloseIcon />
          </button>
        </div>
        <div className="roster">
          {participants.map((p) => (
            <div key={p.identity} className="roster-item">
              <span className="roster-name">
                {p.name || p.identity}
                {p.isLocal ? t(' (나)', ' (me)') : ''}
              </span>
              <span className={`roster-mic ${p.isMicrophoneEnabled ? 'on' : 'off'}`}>
                {p.isMicrophoneEnabled ? <MicIcon /> : <MicOffIcon />}
              </span>
              {canHost && !p.isLocal && (
                <span className="roster-host">
                  <button className="btn-mini ghost" onClick={() => hostAction('mute', p.identity)}>
                    {t('음소거', 'Mute')}
                  </button>
                  <button className="btn-mini ghost danger" onClick={() => hostAction('remove', p.identity)}>
                    {t('내보내기', 'Remove')}
                  </button>
                </span>
              )}
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
    <div className="ctrl-item">
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
      <span className="ctrl-label">{label}</span>
    </div>
  )
}

const BREAKOUTS = ['b1', 'b2', 'b3']
const breakoutLabel = (s: string) => `그룹 ${s.replace('b', '')}`

function RoomInner({
  name,
  userId,
  lang,
  groupId,
  teamId,
  startAudioOn,
  breakoutEnabled = false,
  roomSuffix = '',
  onSwitchBreakout,
  canHost = false,
}: {
  name: string
  userId?: string
  lang: string
  groupId: string
  teamId?: string
  startAudioOn: boolean
  breakoutEnabled?: boolean
  roomSuffix?: string
  onSwitchBreakout?: (suffix: string) => void
  canHost?: boolean
}) {
  const t = useT()
  const [breakoutOpen, setBreakoutOpen] = useState(false)
  const roomName = teamId ? `team:${teamId}${roomSuffix ? ':' + roomSuffix : ''}` : undefined
  const room = useRoomContext()
  const [micDeviceId, setMicDeviceId] = useState<string | undefined>(undefined)
  const [speakerVolume, setSpeakerVolume] = useState(100)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [peopleOpen, setPeopleOpen] = useState(false)
  const [signOn, setSignOn] = useState(false)
  const [signVideo, setSignVideo] = useState<HTMLVideoElement | null>(null)
  const [signStatus, setSignStatus] = useState<SignStatus | null>(null)
  const [blurOn, setBlurOn] = useState(false)
  const [panel, setPanel] = useState<'chat' | 'docs' | null>(null)
  const togglePanel = (p: 'chat' | 'docs') => setPanel((cur) => (cur === p ? null : p))
  const [dockWidth, setDockWidth] = useState(() =>
    Math.round(Math.min(540, window.innerWidth * 0.46)),
  )
  const startResize = (e: ReactMouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = dockWidth
    // Dock never dominates: capped at 54% of the window.
    const onMove = (ev: MouseEvent) =>
      setDockWidth(Math.min(window.innerWidth * 0.54, Math.max(280, startW + (startX - ev.clientX))))
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const mic = useLocalMic(room, micDeviceId, !startAudioOn)
  useSpeakerVolume(speakerVolume / 100)
  const { localParticipant } = useLocalParticipant()
  const blurRef = useRef<ReturnType<typeof BackgroundBlur> | null>(null)
  const cameraSid = localParticipant.getTrackPublication(Track.Source.Camera)?.trackSid

  // Apply/remove the client-side background blur processor on the local camera track.
  useEffect(() => {
    const track = localParticipant.getTrackPublication(Track.Source.Camera)?.track as
      | LocalVideoTrack
      | undefined
    if (!track) return
    let cancelled = false
    ;(async () => {
      try {
        if (blurOn) {
          if (!blurRef.current) blurRef.current = BackgroundBlur(10)
          if (!cancelled) await track.setProcessor(blurRef.current)
        } else if (track.getProcessor()) {
          await track.stopProcessor()
        }
      } catch {
        /* processor unsupported on this device — ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [blurOn, localParticipant, cameraSid])
  const captions = useCaptions(room, {
    speaker: name,
    sourceLang: lang,
    targetLangs: ['ko', 'en'],
    signEnabled: signOn,
    signVideoEl: signVideo,
    onSignStatus: setSignStatus,
  })

  return (
    <>
      <div className="stage-area">
        <Stage />
        {teamId && <WaitingRoom teamId={teamId} />}
        {signOn && (
          <div className="sign-panel glass">
            <video ref={setSignVideo} className="sign-preview" muted playsInline />
            <div className={`sign-status ${signStatus?.hand ? 'on' : ''}`}>
              {!signStatus?.ready ? (
                <span>{t('수화 카메라 준비 중…', 'Preparing sign camera…')}</span>
              ) : signStatus.label ? (
                <span className="sign-detected">✋ {signStatus.label}</span>
              ) : signStatus.hand ? (
                <span>{t('✋ 손 인식됨 — 제스처를 취해보세요', '✋ Hand detected — try a gesture')}</span>
              ) : (
                <span>{t('손을 화면에 보여주세요', 'Show your hand to the camera')}</span>
              )}
            </div>
          </div>
        )}
        {roomSuffix && (
          <div className="breakout-banner glass">
            <span>{t('브레이크아웃', 'Breakout')} · {t(breakoutLabel(roomSuffix), `Group ${roomSuffix.replace('b', '')}`)}</span>
            <button className="btn-mini" onClick={() => onSwitchBreakout?.('')}>
              {t('메인으로 돌아가기', 'Back to main room')}
            </button>
          </div>
        )}
        <Captions entries={captions} displayLang={lang} />

        <div className="glass controlbar">
          <div className="ctrl-item">
            <button
              className={`ctrl ${mic.muted ? 'ctrl-off' : 'ctrl-on'}`}
              onClick={mic.toggleMute}
              aria-pressed={!mic.muted}
              aria-label={t('마이크', 'Microphone')}
              title={t('마이크', 'Microphone')}
            >
              {mic.muted ? <MicOffIcon /> : <MicIcon />}
            </button>
            <span className="ctrl-label">{t('마이크', 'Mic')}</span>
          </div>
          <Toggle source={Track.Source.Camera} on={<VideoIcon />} off={<VideoOffIcon />} label={t('카메라', 'Camera')} />
          <Toggle source={Track.Source.ScreenShare} on={<ScreenIcon />} off={<ScreenIcon />} label={t('화면 공유', 'Share screen')} />
          <div className="ctrl-item">
            <button
              className={`ctrl ${settingsOpen ? 'ctrl-on' : 'ctrl-off'}`}
              onClick={() => setSettingsOpen((v) => !v)}
              aria-label={t('설정', 'Settings')}
              title={t('설정', 'Settings')}
            >
              <SettingsIcon />
            </button>
            <span className="ctrl-label">{t('설정', 'Settings')}</span>
          </div>
          <div className="ctrl-item">
            <button
              className={`ctrl ${panel === 'chat' ? 'ctrl-on' : 'ctrl-off'}`}
              onClick={() => togglePanel('chat')}
              aria-label={t('채팅·자막', 'Chat & captions')}
              title={t('채팅·자막', 'Chat & captions')}
            >
              <ChatIcon />
            </button>
            <span className="ctrl-label">{t('채팅·자막', 'Chat & captions')}</span>
          </div>
          <div className="ctrl-item">
            <button
              className={`ctrl ${signOn ? 'ctrl-on' : 'ctrl-off'}`}
              onClick={() => setSignOn((v) => !v)}
              aria-pressed={signOn}
              aria-label={t('수화', 'Sign language')}
              title={t('수화 인식', 'Sign language recognition')}
            >
              <SignIcon />
            </button>
            <span className="ctrl-label">{t('수화', 'Sign')}</span>
          </div>
          <div className="ctrl-item">
            <button
              className={`ctrl ${blurOn ? 'ctrl-on' : 'ctrl-off'}`}
              onClick={() => setBlurOn((v) => !v)}
              aria-pressed={blurOn}
              aria-label={t('배경 흐림', 'Background blur')}
              title={t('배경 흐림', 'Background blur')}
            >
              <BlurIcon />
            </button>
            <span className="ctrl-label">{t('배경 흐림', 'Blur')}</span>
          </div>
          {breakoutEnabled && (
            <div className="ctrl-item breakout-ctrl">
              <button
                className={`ctrl ${roomSuffix ? 'ctrl-on' : 'ctrl-off'}`}
                onClick={() => setBreakoutOpen((v) => !v)}
                aria-label={t('브레이크아웃', 'Breakout')}
                title={t('브레이크아웃 룸', 'Breakout rooms')}
              >
                <PeopleIcon />
              </button>
              <span className="ctrl-label">{t('브레이크아웃', 'Breakout')}</span>
              {breakoutOpen && (
                <>
                  <div className="menu-catch" onClick={() => setBreakoutOpen(false)} />
                  <div className="breakout-menu glass">
                    <div className="breakout-menu-head">{t('브레이크아웃 룸', 'Breakout rooms')}</div>
                    <button
                      className={`breakout-opt ${!roomSuffix ? 'on' : ''}`}
                      onClick={() => {
                        onSwitchBreakout?.('')
                        setBreakoutOpen(false)
                      }}
                    >
                      {t('메인 룸', 'Main room')}
                    </button>
                    {BREAKOUTS.map((b) => (
                      <button
                        key={b}
                        className={`breakout-opt ${roomSuffix === b ? 'on' : ''}`}
                        onClick={() => {
                          onSwitchBreakout?.(b)
                          setBreakoutOpen(false)
                        }}
                      >
                        {t(breakoutLabel(b), `Group ${b.replace('b', '')}`)}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          <div className="ctrl-item">
            <button
              className={`ctrl ${peopleOpen ? 'ctrl-on' : 'ctrl-off'}`}
              onClick={() => setPeopleOpen((v) => !v)}
              aria-label={t('참가자', 'Participants')}
              title={t('참가자', 'Participants')}
            >
              <PeopleIcon />
            </button>
            <span className="ctrl-label">{t('참가자', 'Participants')}</span>
          </div>
          <div className="ctrl-item">
            <button
              className={`ctrl ${panel === 'docs' ? 'ctrl-on' : 'ctrl-off'}`}
              onClick={() => togglePanel('docs')}
              aria-label={t('문서', 'Docs')}
              title={t('문서', 'Docs')}
            >
              <DocIcon />
            </button>
            <span className="ctrl-label">{t('문서', 'Docs')}</span>
          </div>
          <span className="ctrl-divider" />
          <div className="ctrl-item">
            <button
              className="ctrl ctrl-leave"
              onClick={() => room.disconnect()}
              aria-label={t('나가기', 'Leave')}
              title={t('나가기', 'Leave')}
            >
              <LeaveIcon />
            </button>
            <span className="ctrl-label leave">{t('나가기', 'Leave')}</span>
          </div>
        </div>

        {/* Sheets overlay only the stage (never the dock), so they follow the video area. */}
        <ParticipantsSheet
          open={peopleOpen}
          onClose={() => setPeopleOpen(false)}
          canHost={canHost}
          room={roomName}
        />
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
      </div>

      {panel && (
        <div className="dock" style={{ width: dockWidth }}>
          <div className="dock-resize" onMouseDown={startResize} title={t('드래그로 크기 조절', 'Drag to resize')} />
          <div className="dock-tabs">
            <button className={panel === 'chat' ? 'on' : ''} onClick={() => setPanel('chat')}>
              {t('채팅·자막', 'Chat & captions')}
            </button>
            <button className={panel === 'docs' ? 'on' : ''} onClick={() => setPanel('docs')}>
              {t('문서', 'Docs')}
            </button>
            <button className="icon-btn small dock-close" onClick={() => setPanel(null)} aria-label={t('닫기', 'Close')}>
              <CloseIcon />
            </button>
          </div>
          <div className="dock-body">
            {panel === 'chat' && <ChatFeed captions={captions} displayLang={lang} myName={name} />}
            {panel === 'docs' && <DocsView groupId={groupId} lang={lang} userId={userId} userName={name} />}
          </div>
        </div>
      )}
    </>
  )
}

export function RoomView({
  serverUrl,
  token,
  name,
  userId,
  lang,
  groupId,
  teamId,
  canHost = false,
  startVideo = true,
  startAudioOn = true,
  onLeave,
}: {
  serverUrl: string
  token: string
  name: string
  userId?: string
  lang: string
  groupId: string
  teamId?: string
  canHost?: boolean
  startVideo?: boolean
  startAudioOn?: boolean
  onLeave: () => void
}) {
  // Breakout rooms = separate LiveKit rooms. Switching re-mints a token for the
  // sub-room and remounts LiveKitRoom (keyed by suffix); the disconnect from the
  // remount is ignored so it isn't mistaken for leaving the meeting.
  const [roomSuffix, setRoomSuffix] = useState('')
  const [activeToken, setActiveToken] = useState(token)
  const switchingRef = useRef(false)

  const switchTo = async (suffix: string) => {
    if (suffix === roomSuffix || !userId) return
    switchingRef.current = true
    if (!suffix) {
      setActiveToken(token)
      setRoomSuffix('')
      return
    }
    try {
      const room = `team:${teamId}:${suffix}`
      const res = await fetch(
        `${API_BASE}/api/token?room=${encodeURIComponent(room)}` +
          `&identity=${encodeURIComponent(userId)}&name=${encodeURIComponent(name)}`,
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'token error')
      setActiveToken(data.token)
      setRoomSuffix(suffix)
    } catch {
      switchingRef.current = false
    }
  }

  return (
    <LiveKitRoom
      key={roomSuffix}
      className="room"
      token={activeToken}
      serverUrl={serverUrl}
      connect
      video={startVideo}
      audio={false}
      onConnected={() => {
        switchingRef.current = false
      }}
      onDisconnected={() => {
        if (!switchingRef.current) onLeave()
      }}
    >
      <RoomAudioRenderer />
      <RoomInner
        name={name}
        userId={userId}
        lang={lang}
        groupId={groupId}
        teamId={teamId}
        startAudioOn={startAudioOn}
        breakoutEnabled={!!teamId && !!userId}
        roomSuffix={roomSuffix}
        onSwitchBreakout={switchTo}
        canHost={canHost}
      />
    </LiveKitRoom>
  )
}
