import { useState } from 'react'
import { updateProfile } from './teams'
import { CloseIcon } from '../../components/ui/icons'
import { Select } from '../../components/ui/Select'
import { useT } from '../../lib/i18n'

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
  const t = useT()

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
      <div className="glass modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t('프로필 수정', 'Edit profile')}>
        <div className="modal-head">
          <h2>{t('프로필 수정', 'Edit profile')}</h2>
          <button className="icon-btn small" onClick={onClose} aria-label={t('닫기', 'Close')}>
            <CloseIcon />
          </button>
        </div>

        <div className="avatar lg">{(name || '?').slice(0, 2)}</div>

        <input className="field" placeholder={t('이름', 'Name')} value={name} onChange={(e) => setName(e.target.value)} />

        <div className="lang-row">
          <span className="subtitle">{t('언어', 'Language')}</span>
          <div className="segmented compact" role="tablist" aria-label={t('언어', 'Language')}>
            <button role="tab" aria-selected={language === 'ko'} onClick={() => setLanguage('ko')}>
              한국어
            </button>
            <button role="tab" aria-selected={language === 'en'} onClick={() => setLanguage('en')}>
              English
            </button>
          </div>
        </div>

        <div className="lang-row">
          <span className="subtitle">{t('직군', 'Role')}</span>
          <div style={{ flex: 1, maxWidth: 220 }}>
            <Select
              value={jobRole}
              onChange={setJobRole}
              options={JOB_ROLES.map((r) => ({ value: r, label: r }))}
            />
          </div>
        </div>

        <button className="btn-primary" disabled={!name.trim() || busy} onClick={save}>
          {busy ? t('저장 중…', 'Saving…') : t('저장', 'Save')}
        </button>
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  )
}
