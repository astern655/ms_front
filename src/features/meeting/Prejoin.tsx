import { useEffect, useRef, useState } from 'react'
import { usePreviewTracks } from '@livekit/components-react'
import { Track, type LocalVideoTrack } from 'livekit-client'
import { MicIcon, MicOffIcon, VideoIcon, VideoOffIcon } from '../../components/ui/icons'
import { useT } from '../../lib/i18n'

// Device preview before joining: pick camera/mic on-off and see yourself.
export function Prejoin({
  teamName,
  name,
  onJoin,
  onCancel,
}: {
  teamName: string
  name: string
  onJoin: (choices: { video: boolean; audio: boolean }) => void
  onCancel: () => void
}) {
  const t = useT()
  const [video, setVideo] = useState(true)
  const [audio, setAudio] = useState(true)
  const videoRef = useRef<HTMLVideoElement>(null)

  const tracks = usePreviewTracks({ audio, video })
  const camTrack = tracks?.find((t) => t.kind === Track.Kind.Video) as LocalVideoTrack | undefined

  useEffect(() => {
    const el = videoRef.current
    if (camTrack && el) {
      camTrack.attach(el)
      return () => {
        camTrack.detach(el)
      }
    }
  }, [camTrack])

  return (
    <div className="prejoin">
      <div className="prejoin-card glass">
        <div className="prejoin-preview">
          {video ? (
            <video ref={videoRef} autoPlay muted playsInline className="prejoin-video" />
          ) : (
            <div className="prejoin-off">
              <span className="avatar lg">{name.slice(0, 2)}</span>
              <span>{t('카메라 꺼짐', 'Camera off')}</span>
            </div>
          )}
          <div className="prejoin-devbar">
            <button
              className={`ctrl ${video ? 'ctrl-on' : 'ctrl-off'}`}
              onClick={() => setVideo((v) => !v)}
              title={t('카메라', 'Camera')}
            >
              {video ? <VideoIcon /> : <VideoOffIcon />}
            </button>
            <button
              className={`ctrl ${audio ? 'ctrl-on' : 'ctrl-off'}`}
              onClick={() => setAudio((v) => !v)}
              title={t('마이크', 'Microphone')}
            >
              {audio ? <MicIcon /> : <MicOffIcon />}
            </button>
          </div>
        </div>

        <div className="prejoin-side">
          <h2 className="prejoin-title"># {teamName}</h2>
          <p className="subtitle">{t('입장 전 카메라와 마이크를 확인하세요.', 'Check your camera and mic before joining.')}</p>
          <div className="prejoin-actions">
            <button className="btn-primary" onClick={() => onJoin({ video, audio })}>
              {t('입장하기', 'Join')}
            </button>
            <button className="btn-ghost" onClick={onCancel}>
              {t('취소', 'Cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
