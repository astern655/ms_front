import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, type Profile } from './lib/supabase'
import { AuthScreen } from './features/auth/AuthScreen'
import { Onboarding } from './features/auth/Onboarding'
import { Workspace } from './features/workspace/Workspace'
import { joinGroupByCode } from './features/groups/teams'
import { LangProvider, browserLang, type Lang } from './lib/i18n'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileChecked, setProfileChecked] = useState(false)
  const [invite, setInvite] = useState<string | null>(
    () => new URLSearchParams(window.location.search).get('invite'),
  )

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (!s) setProfile(null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) {
      setProfile(null)
      setProfileChecked(false)
      return
    }
    setProfileChecked(false)
    supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        setProfile((data as Profile) ?? null)
        setProfileChecked(true)
      })
  }, [session])

  // Accept a group invite link (/?invite=CODE) once logged in + onboarded.
  useEffect(() => {
    if (!invite || !session || !profile) return
    joinGroupByCode(invite)
      .catch(() => {})
      .finally(() => {
        window.history.replaceState({}, '', window.location.pathname)
        setInvite(null)
      })
  }, [invite, session, profile])

  if (!ready) return null

  const lang: Lang = profile?.language === 'en' ? 'en' : profile?.language === 'ko' ? 'ko' : browserLang()

  let content: ReactNode = null
  if (!session) content = <AuthScreen />
  else if (!profileChecked) content = null
  else if (!profile)
    content = (
      <Onboarding
        userId={session.user.id}
        defaultName={session.user.email?.split('@')[0]}
        onDone={setProfile}
      />
    )
  else if (invite) content = null
  else
    content = (
      <Workspace
        profile={{
          id: profile.id,
          name: profile.name,
          language: profile.language,
          job_role: profile.job_role,
        }}
        onSignOut={() => supabase.auth.signOut()}
        onProfileChange={(p) => setProfile((prev) => (prev ? { ...prev, ...p } : prev))}
      />
    )

  return <LangProvider value={lang}>{content}</LangProvider>
}
