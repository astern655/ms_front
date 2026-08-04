import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, type Profile } from './lib/supabase'
import { AuthScreen } from './components/auth/AuthScreen'
import { Onboarding } from './components/auth/Onboarding'
import { Workspace } from './components/nav/Workspace'
import { joinGroupByCode } from './lib/teams'

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
  if (!session) return <AuthScreen />
  if (!profileChecked) return null
  if (!profile)
    return (
      <Onboarding
        userId={session.user.id}
        defaultName={session.user.email?.split('@')[0]}
        onDone={setProfile}
      />
    )
  if (invite) return null
  return (
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
}
