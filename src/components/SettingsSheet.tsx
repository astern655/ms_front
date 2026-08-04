import { useEffect, useState, type RefObject } from 'react'
import { useMediaDeviceSelect } from '@livekit/components-react'
import { MicIcon, SpeakerIcon, VideoIcon, CloseIcon } from './icons'
import { Select } from './Select'

function DeviceSelect({
  kind,
  devices,
  activeId,
  onChange,
}: {
  kind: string
  devices: MediaDeviceInfo[]
  activeId: string
  onChange: (id: string) => void
}) {
  return (
    <Select
      value={activeId}
      onChange={onChange}
      placeholder={kind}
      options={devices.map((d, i) => ({
        value: d.deviceId,
        label: d.label || `${kind} ${i + 1}`,
      }))}
    />
  )
}

export function SettingsSheet({
  open,
  onClose,
  micDeviceId,
  setMicDeviceId,
  setGain,
  levelRef,
  speakerVolume,
  setSpeakerVolume,
}: {
  open: boolean
  onClose: () => void
  micDeviceId: string | undefined
  setMicDeviceId: (id: string) => void
  setGain: (v: number) => void
  levelRef: RefObject<number>
  speakerVolume: number
  setSpeakerVolume: (v: number) => void
}) {
  const [micGain, setMicGain] = useState(100)
  const [level, setLevel] = useState(0)
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([])

  // Speaker + camera switching is handled by LiveKit.
  const speaker = useMediaDeviceSelect({ kind: 'audiooutput' })
  const camera = useMediaDeviceSelect({ kind: 'videoinput' })

  // Mic devices are enumerated manually (mic track is custom-published).
  useEffect(() => {
    if (!open) return
    navigator.mediaDevices
      .enumerateDevices()
      .then((all) => setMicDevices(all.filter((d) => d.kind === 'audioinput')))
  }, [open])

  // Live input meter while the sheet is open.
  useEffect(() => {
    if (!open) return
    let raf = 0
    const tick = () => {
      setLevel(levelRef.current ?? 0)
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [open, levelRef])

  if (!open) return null
  const activeMic = micDeviceId ?? micDevices[0]?.deviceId ?? ''

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="glass sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="설정">
        <div className="sheet-grabber" />
        <div className="sheet-head">
          <h2>설정</h2>
          <button className="icon-btn small" onClick={onClose} aria-label="닫기">
            <CloseIcon />
          </button>
        </div>

        <section className="setting-group">
          <div className="setting-label"><MicIcon /> 마이크</div>
          <DeviceSelect kind="마이크" devices={micDevices} activeId={activeMic} onChange={setMicDeviceId} />
          <div className="meter">
            <div className="meter-fill" style={{ width: `${Math.round(level * 100)}%` }} />
          </div>
          <div className="slider-row">
            <span className="subtitle">입력 볼륨</span>
            <input
              type="range" min={0} max={200} value={micGain}
              onChange={(e) => {
                const v = Number(e.target.value)
                setMicGain(v)
                setGain(v / 100)
              }}
            />
            <span className="slider-val">{micGain}%</span>
          </div>
        </section>

        <section className="setting-group">
          <div className="setting-label"><SpeakerIcon /> 스피커</div>
          <DeviceSelect
            kind="스피커"
            devices={speaker.devices}
            activeId={speaker.activeDeviceId}
            onChange={(id) => speaker.setActiveMediaDevice(id)}
          />
          <div className="slider-row">
            <span className="subtitle">출력 볼륨</span>
            <input
              type="range" min={0} max={100} value={speakerVolume}
              onChange={(e) => setSpeakerVolume(Number(e.target.value))}
            />
            <span className="slider-val">{speakerVolume}%</span>
          </div>
        </section>

        <section className="setting-group">
          <div className="setting-label"><VideoIcon /> 카메라</div>
          <DeviceSelect
            kind="카메라"
            devices={camera.devices}
            activeId={camera.activeDeviceId}
            onChange={(id) => camera.setActiveMediaDevice(id)}
          />
        </section>
      </div>
    </div>
  )
}
