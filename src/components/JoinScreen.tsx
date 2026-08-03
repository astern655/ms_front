import { useMemo, useState } from 'react'
import { generateRoomCode, normalizeRoomCode } from '../lib/roomCode'
import { CopyIcon, CheckIcon } from './icons'

type Mode = 'create' | 'join'

export function JoinScreen({
  onJoin,
  busy,
  error,
}: {
  onJoin: (args: { code: string; name: string; lang: string }) => void
  busy: boolean
  error: string
}) {
  const [mode, setMode] = useState<Mode>('create')
  const [name, setName] = useState('')
  const [lang, setLang] = useState('ko')
  const [codeInput, setCodeInput] = useState('')
  const [copied, setCopied] = useState(false)

  // A fresh code for "create" mode, generated once per screen mount.
  const newCode = useMemo(() => generateRoomCode(), [])

  const code = mode === 'create' ? newCode : normalizeRoomCode(codeInput)
  const canJoin = name.trim().length > 0 && code.length >= 4 && !busy

  const copy = async () => {
    await navigator.clipboard.writeText(newCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="join-wrap">
      <div className="glass join-card">
        <div>
          <h1 className="brand">Borderless</h1>
          <p className="subtitle">경계 없는 화상 회의</p>
        </div>

        <div className="segmented" role="tablist" aria-label="입장 방식">
          <button
            role="tab"
            aria-selected={mode === 'create'}
            onClick={() => setMode('create')}
          >
            새 회의 만들기
          </button>
          <button
            role="tab"
            aria-selected={mode === 'join'}
            onClick={() => setMode('join')}
          >
            코드로 참여
          </button>
        </div>

        <input
          className="field"
          placeholder="이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="lang-row">
          <span className="subtitle">내 언어</span>
          <div className="segmented compact" role="tablist" aria-label="내 언어">
            <button role="tab" aria-selected={lang === 'ko'} onClick={() => setLang('ko')}>
              한국어
            </button>
            <button role="tab" aria-selected={lang === 'en'} onClick={() => setLang('en')}>
              English
            </button>
          </div>
        </div>

        {mode === 'create' ? (
          <div className="code-box">
            <span className="code-text">{newCode}</span>
            <button
              className="icon-btn"
              onClick={copy}
              aria-label="코드 복사"
              title="코드 복사"
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
            </button>
          </div>
        ) : (
          <input
            className="field code-field"
            placeholder="참여 코드"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            autoCapitalize="characters"
            onKeyDown={(e) =>
              e.key === 'Enter' && canJoin && onJoin({ code, name: name.trim(), lang })
            }
          />
        )}

        <button
          className="btn-primary"
          disabled={!canJoin}
          onClick={() => onJoin({ code, name: name.trim(), lang })}
        >
          {busy ? '연결 중…' : mode === 'create' ? '만들고 입장' : '입장'}
        </button>

        {error && <p className="error">{error}</p>}
      </div>
    </div>
  )
}
