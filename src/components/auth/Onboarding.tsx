import { useState } from 'react'
import { supabase, type Profile } from '../../lib/supabase'
import { Select } from '../Select'

const JOB_ROLES = ['기획/PM', '디자인', '프론트엔드', '백엔드', 'AI/데이터', '기타']

export function Onboarding({
  userId,
  defaultName,
  onDone,
}: {
  userId: string
  defaultName?: string
  onDone: (p: Profile) => void
}) {
  const [name, setName] = useState(defaultName ?? '')
  const [language, setLanguage] = useState('ko')
  const [jobRole, setJobRole] = useState(JOB_ROLES[0])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setError('')
    setBusy(true)
    try {
      const row = { id: userId, name: name.trim(), language, job_role: jobRole, avatar_url: null }
      const { data, error } = await supabase.from('profiles').insert(row).select().single()
      if (error) throw error
      onDone(data as Profile)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="join-wrap">
      <div className="glass join-card">
        <div>
          <h1 className="brand">프로필</h1>
          <p className="subtitle">팀에서 어떻게 보일지 알려주세요</p>
        </div>

        <input
          className="field"
          placeholder="이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

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

        <button className="btn-primary" disabled={!name.trim() || busy} onClick={submit}>
          {busy ? '저장 중…' : '시작하기'}
        </button>
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  )
}
