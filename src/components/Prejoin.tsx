import { useEffect, useRef, useState } from 'react'
import { usePreviewTracks } from '@livekit/components-react'
import { Track, type LocalVideoTrack } from 'livekit-client'
import { MicIcon, MicOffIcon, VideoIcon, VideoOffIcon } from './icons'

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
              <span>카메라 꺼짐</span>
            </div>
          )}
          <div className="prejoin-devbar">
            <button
              className={`ctrl ${video ? 'ctrl-on' : 'ctrl-off'}`}
              onClick={() => setVideo((v) => !v)}
              title="카메라"
            >
              {video ? <VideoIcon /> : <VideoOffIcon />}
            </button>
            <button
              className={`ctrl ${audio ? 'ctrl-on' : 'ctrl-off'}`}
              onClick={() => setAudio((v) => !v)}
              title="마이크"
            >
              {audio ? <MicIcon /> : <MicOffIcon />}
            </button>
          </div>
        </div>

        <div className="prejoin-side">
          <h2 className="prejoin-title"># {teamName}</h2>
          <p className="subtitle">입장 전 카메라와 마이크를 확인하세요.</p>
          <div className="prejoin-actions">
            <button className="btn-primary" onClick={() => onJoin({ video, audio })}>
              입장하기
            </button>
            <button className="btn-ghost" onClick={onCancel}>
              취소
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
