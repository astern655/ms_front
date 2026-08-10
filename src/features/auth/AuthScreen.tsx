import { useState } from 'react'
import { supabase } from '../../lib/supabase'

type Mode = 'login' | 'signup'

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const submit = async () => {
    setError('')
    setNotice('')
    setBusy(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        // App's auth listener routes on success.
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        if (!data.session) {
          setNotice('확인 메일을 보냈어요. 메일의 링크를 눌러 인증한 뒤 로그인하세요.')
          setMode('login')
        }
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const canSubmit = email.trim() && password.length >= 6 && !busy

  return (
    <div className="join-wrap">
      <div className="glass join-card">
        <div>
          <h1 className="brand">Borderless</h1>
          <p className="subtitle">경계 없는 협업 공간</p>
        </div>

        <div className="segmented" role="tablist" aria-label="인증">
          <button role="tab" aria-selected={mode === 'login'} onClick={() => setMode('login')}>
            로그인
          </button>
          <button role="tab" aria-selected={mode === 'signup'} onClick={() => setMode('signup')}>
            회원가입
          </button>
        </div>

        <input
          className="field"
          type="email"
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <input
          className="field"
          type="password"
          placeholder="비밀번호 (6자 이상)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && canSubmit && submit()}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        />

        <button className="btn-primary" disabled={!canSubmit} onClick={submit}>
          {busy ? '처리 중…' : mode === 'login' ? '로그인' : '회원가입'}
        </button>

        {notice && <p className="subtitle">{notice}</p>}
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  )
}
