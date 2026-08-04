import { useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { RoomView } from '../RoomView'
import { API_BASE } from '../../lib/api'
import {
  listGroups,
  createGroup,
  listTeams,
  createTeam,
  ensureTeamMembership,
  joinGroupByCode,
  type Group,
  type Team,
} from '../../lib/teams'
import { GroupSettings } from '../GroupSettings'
import { ProfileEdit } from '../ProfileEdit'
import { DocsView } from '../DocsView'
import { AiPanel } from '../AiPanel'
import { SettingsIcon, LogoutIcon } from '../icons'

const serverUrl =
  (import.meta.env.VITE_LIVEKIT_URL as string | undefined) ??
  'wss://ms-hack-ly6rx40h.livekit.cloud'

type Profile = { id: string; name: string; language: string; job_role?: string | null }

export function Workspace({
  profile,
  onSignOut,
  onProfileChange,
}: {
  profile: Profile
  onSignOut: () => void
  onProfileChange: (p: { name: string; language: string; job_role: string }) => void
}) {
  const [groups, setGroups] = useState<Group[]>([])
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [active, setActive] = useState<{ team: Team; token: string } | null>(null)
  const [presence, setPresence] = useState<Record<string, string[]>>({})
  const [error, setError] = useState('')
  const [newGroup, setNewGroup] = useState('')
  const [newTeam, setNewTeam] = useState('')
  const [addingGroup, setAddingGroup] = useState(false)
  const [joining, setJoining] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [groupMenu, setGroupMenu] = useState(false)
  const [view, setView] = useState<'board' | 'docs' | 'ai'>('board')

  const channelRef = useRef<RealtimeChannel | null>(null)
  const activeTeamId = active?.team.id ?? null
  const activeTeamRef = useRef<string | null>(null)
  activeTeamRef.current = activeTeamId

  useEffect(() => {
    listGroups()
      .then((g) => {
        setGroups(g)
        setActiveGroupId((cur) => cur ?? g[0]?.id ?? null)
      })
      .catch((e) => setError((e as Error).message))
  }, [])

  useEffect(() => {
    if (!activeGroupId) {
      setTeams([])
      return
    }
    listTeams(activeGroupId)
      .then(setTeams)
      .catch((e) => setError((e as Error).message))
  }, [activeGroupId])

  // Live presence per group: who is currently in which team.
  useEffect(() => {
    if (!activeGroupId) return
    const ch = supabase.channel(`group:${activeGroupId}`, {
      config: { presence: { key: profile.id } },
    })
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState() as Record<string, { teamId: string | null; name: string }[]>
      const map: Record<string, string[]> = {}
      for (const metas of Object.values(state)) {
        for (const m of metas) if (m.teamId) (map[m.teamId] ??= []).push(m.name)
      }
      setPresence(map)
    })
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') ch.track({ teamId: activeTeamRef.current, name: profile.name })
    })
    channelRef.current = ch
    return () => {
      supabase.removeChannel(ch)
      channelRef.current = null
    }
  }, [activeGroupId, profile.id, profile.name])

  // Broadcast which team I'm in whenever it changes.
  useEffect(() => {
    channelRef.current?.track({ teamId: activeTeamId, name: profile.name })
  }, [activeTeamId, profile.name])

  const activeGroup = groups.find((g) => g.id === activeGroupId) ?? null
  const isOwner = !!activeGroup && activeGroup.owner_id === profile.id

  const addGroup = async () => {
    const name = newGroup.trim()
    if (!name) return
    try {
      const g = await createGroup(name, profile.id)
      setGroups((prev) => [...prev, g])
      setActiveGroupId(g.id)
      setNewGroup('')
      setAddingGroup(false)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const addTeam = async () => {
    const name = newTeam.trim()
    if (!name || !activeGroupId) return
    try {
      const t = await createTeam(activeGroupId, name, profile.id)
      setTeams((prev) => [...prev, t])
      setNewTeam('')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const joinGroup = async () => {
    const raw = joinCode.trim()
    if (!raw) return
    // Accept either a raw code or a pasted invite link (…?invite=CODE).
    const code = raw.includes('invite=')
      ? new URLSearchParams(raw.split('?')[1] ?? '').get('invite') || raw
      : raw
    try {
      const gid = await joinGroupByCode(code)
      const gs = await listGroups()
      setGroups(gs)
      setActiveGroupId(gid)
      setJoinCode('')
      setJoining(false)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const refreshAfterSettings = async () => {
    try {
      const gs = await listGroups()
      setGroups(gs)
      if (activeGroupId) setTeams(await listTeams(activeGroupId))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const enterTeam = async (team: Team) => {
    setError('')
    try {
      await ensureTeamMembership(team.id, profile.id)
      const res = await fetch(
        `${API_BASE}/api/token?room=${encodeURIComponent('team:' + team.id)}` +
          `&identity=${encodeURIComponent(profile.id)}&name=${encodeURIComponent(profile.name)}`,
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'token error')
      setActive({ team, token: data.token })
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar glass">
        <div className="tb-left">
          <span className="tb-brand">Borderless</span>
          <div className="group-switch">
            <button className="group-pill" onClick={() => setGroupMenu((v) => !v)}>
              {activeGroup?.name ?? '그룹 선택'} <span className="caret">▾</span>
            </button>
            {groupMenu && (
              <>
                <div className="menu-catch" onClick={() => setGroupMenu(false)} />
                <div className="menu glass">
                  {groups.map((g) => (
                    <button
                      key={g.id}
                      className={`menu-item ${g.id === activeGroupId ? 'on' : ''}`}
                      onClick={() => {
                        setActiveGroupId(g.id)
                        setGroupMenu(false)
                      }}
                    >
                      {g.name}
                    </button>
                  ))}
                  <div className="menu-sep" />
                  {addingGroup ? (
                    <input
                      className="field create-input"
                      placeholder="새 그룹 이름"
                      value={newGroup}
                      autoFocus
                      onChange={(e) => setNewGroup(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addGroup()}
                    />
                  ) : (
                    <button className="menu-item" onClick={() => setAddingGroup(true)}>
                      + 그룹 만들기
                    </button>
                  )}
                  {joining ? (
                    <input
                      className="field create-input"
                      placeholder="초대 링크 또는 코드"
                      value={joinCode}
                      autoFocus
                      onChange={(e) => setJoinCode(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && joinGroup()}
                    />
                  ) : (
                    <button className="menu-item" onClick={() => setJoining(true)}>
                      ↳ 코드로 참가
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
          {activeGroup && isOwner && (
            <button className="icon-btn small" onClick={() => setSettingsOpen(true)} title="그룹 설정">
              <SettingsIcon />
            </button>
          )}
        </div>

        {active && (
          <div className="tb-teams">
            {teams.map((t) => {
              const n = (presence[t.id] ?? []).length
              return (
                <button
                  key={t.id}
                  className={`tb-chip ${t.id === activeTeamId ? 'on' : ''}`}
                  onClick={() => enterTeam(t)}
                >
                  # {t.name}
                  {n > 0 && <span className="chip-dot" />}
                </button>
              )
            })}
          </div>
        )}

        {!active && activeGroup && (
          <div className="tb-toggle">
            <button className={view === 'board' ? 'on' : ''} onClick={() => setView('board')}>
              보드
            </button>
            <button className={view === 'docs' ? 'on' : ''} onClick={() => setView('docs')}>
              문서
            </button>
            <button className={view === 'ai' ? 'on' : ''} onClick={() => setView('ai')}>
              AI
            </button>
          </div>
        )}

        <div className="tb-right">
          {active && (
            <button className="btn-ghost" onClick={() => setActive(null)}>
              보드
            </button>
          )}
          <button className="avatar sm" onClick={() => setProfileOpen(true)} title="프로필 수정">
            {profile.name.slice(0, 2)}
          </button>
          <button className="icon-btn small" onClick={onSignOut} title="로그아웃">
            <LogoutIcon />
          </button>
        </div>
      </header>

      <div className="app-content">
        {active ? (
          <RoomView
            key={active.team.id}
            serverUrl={serverUrl}
            token={active.token}
            name={profile.name}
            lang={profile.language}
            groupId={active.team.group_id}
            onLeave={() => setActive(null)}
          />
        ) : activeGroup && view === 'docs' ? (
          <DocsView groupId={activeGroup.id} />
        ) : activeGroup && view === 'ai' ? (
          <div className="ai-page">
            <AiPanel groupId={activeGroup.id} />
          </div>
        ) : activeGroup ? (
          <div className="board">
            {teams.map((t) => {
              const here = presence[t.id] ?? []
              return (
                <button key={t.id} className="room-card" onClick={() => enterTeam(t)}>
                  <div className="rc-name">
                    <span className="hash">#</span>
                    {t.name}
                  </div>
                  <div className="rc-avatars">
                    {here.slice(0, 5).map((name, i) => (
                      <span key={`${name}-${i}`} className="avatar sm" title={name}>
                        {name.slice(0, 2)}
                      </span>
                    ))}
                    {here.length > 5 && <span className="rc-more">+{here.length - 5}</span>}
                    {here.length === 0 && <span className="rc-empty">비어 있음</span>}
                  </div>
                  <div className="rc-foot">{here.length > 0 ? `${here.length}명 참여 중` : '입장하기'}</div>
                </button>
              )
            })}
            <div className="room-card new">
              <div className="rc-name">새 팀</div>
              <input
                className="field create-input"
                placeholder="팀 이름 + Enter"
                value={newTeam}
                onChange={(e) => setNewTeam(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTeam()}
              />
            </div>
          </div>
        ) : (
          <div className="ws-empty">
            <h1 className="brand">Borderless</h1>
            <p className="subtitle">상단에서 그룹을 만들거나 코드로 참가하세요</p>
          </div>
        )}
        {error && <p className="error board-error">{error}</p>}
      </div>

      {settingsOpen && activeGroup && (
        <GroupSettings
          group={activeGroup}
          teams={teams}
          meId={profile.id}
          onClose={() => setSettingsOpen(false)}
          onChanged={refreshAfterSettings}
        />
      )}
      {profileOpen && (
        <ProfileEdit
          profile={profile}
          onClose={() => setProfileOpen(false)}
          onSaved={onProfileChange}
        />
      )}
    </div>
  )
}
