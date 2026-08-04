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
  type Group,
  type Team,
} from '../../lib/teams'

const serverUrl =
  (import.meta.env.VITE_LIVEKIT_URL as string | undefined) ??
  'wss://ms-hack-ly6rx40h.livekit.cloud'

type Profile = { id: string; name: string; language: string }

export function Workspace({ profile, onSignOut }: { profile: Profile; onSignOut: () => void }) {
  const [groups, setGroups] = useState<Group[]>([])
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [active, setActive] = useState<{ team: Team; token: string } | null>(null)
  const [presence, setPresence] = useState<Record<string, string[]>>({})
  const [error, setError] = useState('')
  const [newGroup, setNewGroup] = useState('')
  const [newTeam, setNewTeam] = useState('')
  const [addingGroup, setAddingGroup] = useState(false)

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
    <div className="workspace">
      <nav className="group-rail glass">
        {groups.map((g) => (
          <button
            key={g.id}
            className={`group-btn ${g.id === activeGroupId ? 'on' : ''}`}
            onClick={() => setActiveGroupId(g.id)}
            title={g.name}
          >
            {g.name.slice(0, 2)}
          </button>
        ))}
        <button className="group-btn add" onClick={() => setAddingGroup((v) => !v)} title="그룹 만들기">
          +
        </button>
        <div className="rail-spacer" />
        <button className="group-btn signout-mini" onClick={onSignOut} title="로그아웃">
          ⎋
        </button>
      </nav>

      <aside className="team-panel glass">
        {addingGroup && (
          <input
            className="field create-input"
            placeholder="새 그룹 이름"
            value={newGroup}
            onChange={(e) => setNewGroup(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addGroup()}
            autoFocus
          />
        )}
        <div className="team-panel-head">{activeGroup?.name ?? 'Borderless'}</div>

        {activeGroup ? (
          <>
            <div className="team-list">
              {teams.map((t) => {
                const here = presence[t.id] ?? []
                return (
                  <div key={t.id} className="team-block">
                    <button
                      className={`team-item ${t.id === activeTeamId ? 'on' : ''}`}
                      onClick={() => enterTeam(t)}
                    >
                      <span className="hash">#</span>
                      <span className="team-name">{t.name}</span>
                    </button>
                    {here.length > 0 && (
                      <ul className="member-list">
                        {here.map((name, i) => (
                          <li key={`${name}-${i}`} className="member">
                            <span className="member-dot" />
                            {name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              })}
              {teams.length === 0 && <p className="ws-hint">팀을 만들어 시작하세요</p>}
            </div>
            <input
              className="field create-input"
              placeholder="+ 팀 추가"
              value={newTeam}
              onChange={(e) => setNewTeam(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTeam()}
            />
          </>
        ) : (
          <p className="ws-hint">왼쪽 +로 그룹을 먼저 만드세요</p>
        )}
      </aside>

      <main className="ws-main">
        {active ? (
          <RoomView
            key={active.team.id}
            serverUrl={serverUrl}
            token={active.token}
            code={active.team.name}
            name={profile.name}
            lang={profile.language}
            onLeave={() => setActive(null)}
          />
        ) : (
          <div className="ws-empty">
            <h1 className="brand">Borderless</h1>
            <p className="subtitle">
              {activeGroup ? '팀을 선택해 회의에 입장하세요' : '그룹을 만들어 팀을 구성하세요'}
            </p>
            {error && <p className="error">{error}</p>}
          </div>
        )}
      </main>
    </div>
  )
}
