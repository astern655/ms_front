import { useState } from 'react'
import { updateProfile } from '../lib/teams'
import { CloseIcon } from './icons'
import { Select } from './Select'

const JOB_ROLES = ['기획/PM', '디자인', '프론트엔드', '백엔드', 'AI/데이터', '기타']

export function ProfileEdit({
  profile,
  onClose,
  onSaved,
}: {
  profile: { id: string; name: string; language: string; job_role?: string | null }
  onClose: () => void
  onSaved: (p: { name: string; language: string; job_role: string }) => void
}) {
  const [name, setName] = useState(profile.name)
  const [language, setLanguage] = useState(profile.language)
  const [jobRole, setJobRole] = useState(profile.job_role || JOB_ROLES[0])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    setError('')
    setBusy(true)
    try {
      const fields = { name: name.trim(), language, job_role: jobRole }
      await updateProfile(profile.id, fields)
      onSaved(fields)
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="glass modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="프로필 수정">
        <div className="modal-head">
          <h2>프로필 수정</h2>
          <button className="icon-btn small" onClick={onClose} aria-label="닫기">
            <CloseIcon />
          </button>
        </div>

        <div className="avatar lg">{(name || '?').slice(0, 2)}</div>

        <input className="field" placeholder="이름" value={name} onChange={(e) => setName(e.target.value)} />

        <div className="lang-row">
          <span className="subtitle">언어</span>
          <div className="segmented compact" role="tablist" aria-label="언어">
            <button role="tab" aria-selected={language === 'ko'} onClick={() => setLanguage('ko')}>
              한국어
            </button>
            <button role="tab" aria-selected={language === 'en'} onClick={() => setLanguage('en')}>
              English
            </button>
          </div>
        </div>

        <div className="lang-row">
          <span className="subtitle">직군</span>
          <div style={{ flex: 1, maxWidth: 220 }}>
            <Select
              value={jobRole}
              onChange={setJobRole}
              options={JOB_ROLES.map((r) => ({ value: r, label: r }))}
            />
          </div>
        </div>

        <button className="btn-primary" disabled={!name.trim() || busy} onClick={save}>
          {busy ? '저장 중…' : '저장'}
        </button>
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  )
}
