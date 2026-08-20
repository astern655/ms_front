import { useState } from 'react'
import { supabase, type Profile } from '../../lib/supabase'
import { Select } from '../../components/ui/Select'
import { useT } from '../../lib/i18n'

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
  const t = useT()

  const roleLabel = (r: string): string => {
    switch (r) {
      case '기획/PM':
        return t('기획/PM', 'Planning/PM')
      case '디자인':
        return t('디자인', 'Design')
      case '프론트엔드':
        return t('프론트엔드', 'Frontend')
      case '백엔드':
        return t('백엔드', 'Backend')
      case 'AI/데이터':
        return t('AI/데이터', 'AI/Data')
      default:
        return t('기타', 'Other')
    }
  }

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
          <h1 className="brand">{t('프로필', 'Profile')}</h1>
          <p className="subtitle">{t('팀에서 어떻게 보일지 알려주세요', "Let your team know how you'll appear")}</p>
        </div>

        <input
          className="field"
          placeholder={t('이름', 'Name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="lang-row">
          <span className="subtitle">{t('언어', 'Language')}</span>
          <div className="segmented compact" role="tablist" aria-label={t('언어', 'Language')}>
            <button role="tab" aria-selected={language === 'ko'} onClick={() => setLanguage('ko')}>
              {t('한국어', 'Korean')}
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
              options={JOB_ROLES.map((r) => ({ value: r, label: roleLabel(r) }))}
            />
          </div>
        </div>

        <button className="btn-primary" disabled={!name.trim() || busy} onClick={submit}>
          {busy ? t('저장 중…', 'Saving…') : t('시작하기', 'Get started')}
        </button>
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  )
}
