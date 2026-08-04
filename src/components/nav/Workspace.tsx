import { useEffect, useState } from 'react'
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
  const [error, setError] = useState('')
  const [newGroup, setNewGroup] = useState('')
  const [newTeam, setNewTeam] = useState('')
  const [addingGroup, setAddingGroup] = useState(false)

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

  if (active) {
    return (
      <RoomView
        serverUrl={serverUrl}
        token={active.token}
        code={active.team.name}
        name={profile.name}
        lang={profile.language}
        onLeave={() => setActive(null)}
      />
    )
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
              {teams.map((t) => (
                <button key={t.id} className="team-item" onClick={() => enterTeam(t)}>
                  <span className="hash">#</span>
                  {t.name}
                </button>
              ))}
              {teams.length === 0 && <p className="ws-hint">팀을 만들어 시작하세요</p>}
            </div>
            <div className="team-create">
              <input
                className="field create-input"
                placeholder="+ 팀 추가"
                value={newTeam}
                onChange={(e) => setNewTeam(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTeam()}
              />
            </div>
          </>
        ) : (
          <p className="ws-hint">왼쪽 +로 그룹을 먼저 만드세요</p>
        )}
      </aside>

      <main className="ws-main">
        <div className="ws-empty">
          <h1 className="brand">Borderless</h1>
          <p className="subtitle">
            {activeGroup ? '팀을 선택해 회의에 입장하세요' : '그룹을 만들어 팀을 구성하세요'}
          </p>
          {error && <p className="error">{error}</p>}
        </div>
      </main>
    </div>
  )
}
