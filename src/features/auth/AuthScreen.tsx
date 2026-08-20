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

  const signInGoogle = async () => {
    setError('')
    setBusy(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
      if (error) throw error
      // Redirects to Google; App's auth listener routes on return.
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  const canSubmit = email.trim() && password.length >= 6 && !busy

  return (
    <div className="join-wrap">
      <div className="glass join-card">
        <div className="brand-lockup">
          <img className="brand-logo" src="/weavia-logo.png" alt="WEAVIA" />
          <h1 className="brand">WEAVIA</h1>
          <p className="subtitle">경계 없는 협업 공간</p>
        </div>

        <button className="btn-google" onClick={signInGoogle} disabled={busy}>
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
            <path
              fill="#FFC107"
              d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.5 29.6 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.3-.4-3.5z"
            />
            <path
              fill="#FF3D00"
              d="M7.3 14.7l6.6 4.8C15.7 15.1 19.5 12.5 24 12.5c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.5 29.6 4.5 24 4.5 16.3 4.5 9.7 8.9 7.3 14.7z"
            />
            <path
              fill="#4CAF50"
              d="M24 43.5c5.5 0 10.3-1.9 13.8-5.1l-6.4-5.4c-2 1.5-4.6 2.5-7.4 2.5-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 39 16.2 43.5 24 43.5z"
            />
            <path
              fill="#1976D2"
              d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4 5.6l6.4 5.4C41.6 36.3 43.5 30.6 43.5 24c0-1.2-.1-2.3-.4-3.5z"
            />
          </svg>
          Google로 계속하기
        </button>

        <div className="auth-divider">
          <span>또는 이메일로</span>
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
