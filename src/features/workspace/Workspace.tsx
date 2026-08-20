import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { RoomView } from '../meeting/RoomView'
import { Prejoin } from '../meeting/Prejoin'
import { API_BASE } from '../../lib/api'
import {
  listGroups,
  createGroup,
  listTeams,
  createTeam,
  ensureTeamMembership,
  joinGroupByCode,
  getGroupMembers,
  isTeamMember,
  requestToJoin,
  type Group,
  type Team,
  type Member,
} from '../groups/teams'
import { GroupSettings } from '../groups/GroupSettings'
import { ProfileEdit } from '../groups/ProfileEdit'
import { DocsView } from '../docs/DocsView'
import { TeamChat } from '../chat/TeamChat'
import { ChatBot } from '../agent/ChatBot'
import { NotificationsBell } from '../notifications/NotificationsBell'
import { listMutedTeams, setMuted } from '../chat/mutes'
import { MeetingSchedule } from '../meeting/MeetingSchedule'
import { DMView } from '../chat/DMView'
import { BoardIcon, DocIcon, PeopleIcon, SettingsIcon, LogoutIcon, BellOffIcon, CloseIcon } from '../../components/ui/icons'

const serverUrl =
  (import.meta.env.VITE_LIVEKIT_URL as string | undefined) ??
  'wss://ms-hack-ly6rx40h.livekit.cloud'

type Profile = { id: string; name: string; language: string; job_role?: string | null }
type View = 'board' | 'docs'

const NAV: { key: View; label: string; icon: () => ReactElement }[] = [
  { key: 'board', label: '팀 보드', icon: BoardIcon },
  { key: 'docs', label: '문서', icon: DocIcon },
]

type Status = 'online' | 'away' | 'dnd'
const STATUS: Record<Status, { label: string; color: string }> = {
  online: { label: '온라인', color: '#30d158' },
  away: { label: '자리 비움', color: '#ffcf3f' },
  dnd: { label: '방해 금지', color: '#ff453a' },
}

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
  const [active, setActive] = useState<{
    team: Team
    token: string
    video: boolean
    audio: boolean
  } | null>(null)
  const [pending, setPending] = useState<{ team: Team; token: string } | null>(null)
  const [waiting, setWaiting] = useState<{ team: Team; requestId: string } | null>(null)
  const [channelTeam, setChannelTeam] = useState<Team | null>(null)
  const [dmPeer, setDmPeer] = useState<Member | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [presence, setPresence] = useState<Record<string, string[]>>({})
  const [mutedTeams, setMutedTeams] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const [newGroup, setNewGroup] = useState('')
  const [newTeam, setNewTeam] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [railMenu, setRailMenu] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [view, setView] = useState<View>('board')
  const [status, setStatus] = useState<Status>(
    () => (localStorage.getItem('borderless.status') as Status) || 'online',
  )
  const [statusMenu, setStatusMenu] = useState(false)
  const changeStatus = (s: Status) => {
    setStatus(s)
    localStorage.setItem('borderless.status', s)
    setStatusMenu(false)
    channelRef.current?.track({ teamId: activeTeamId, name: profile.name, status: s })
  }

  const channelRef = useRef<RealtimeChannel | null>(null)
  const activeTeamId = active?.team.id ?? null
  const activeTeamRef = useRef<string | null>(null)
  activeTeamRef.current = activeTeamId
  const statusRef = useRef<Status>('online')
  statusRef.current = status

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
    ch.subscribe((s) => {
      if (s === 'SUBSCRIBED')
        ch.track({ teamId: activeTeamRef.current, name: profile.name, status: statusRef.current })
    })
    channelRef.current = ch
    return () => {
      supabase.removeChannel(ch)
      channelRef.current = null
    }
  }, [activeGroupId, profile.id, profile.name])

  // Broadcast which team I'm in whenever it changes.
  useEffect(() => {
    channelRef.current?.track({ teamId: activeTeamId, name: profile.name, status: statusRef.current })
  }, [activeTeamId, profile.name])

  const activeGroup = groups.find((g) => g.id === activeGroupId) ?? null
  const isOwner = !!activeGroup && activeGroup.owner_id === profile.id

  const switchGroup = (id: string) => {
    setActiveGroupId(id)
    setActive(null)
    setChannelTeam(null)
    setDmPeer(null)
    setView('board')
  }

  const goView = (v: View) => {
    setActive(null)
    setChannelTeam(null)
    setDmPeer(null)
    setView(v)
  }

  const openChannel = (t: Team) => {
    setActive(null)
    setDmPeer(null)
    setChannelTeam(t)
  }

  const openDM = (m: Member) => {
    setActive(null)
    setChannelTeam(null)
    setDmPeer(m)
  }

  const toggleMute = async (teamId: string) => {
    const next = !mutedTeams.has(teamId)
    setMutedTeams((prev) => {
      const s = new Set(prev)
      if (next) s.add(teamId)
      else s.delete(teamId)
      return s
    })
    setMuted(profile.id, teamId, next).catch(() => {})
  }

  useEffect(() => {
    listMutedTeams(profile.id).then(setMutedTeams).catch(() => {})
  }, [profile.id])

  useEffect(() => {
    if (!activeGroupId) return
    getGroupMembers(activeGroupId).then(setMembers).catch(() => {})
  }, [activeGroupId])

  const addGroup = async () => {
    const name = newGroup.trim()
    if (!name) return
    try {
      const g = await createGroup(name, profile.id)
      setGroups((prev) => [...prev, g])
      setActiveGroupId(g.id)
      setNewGroup('')
      setRailMenu(false)
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
      setRailMenu(false)
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

  // Join instantly: ensure membership, mint a token, open the prejoin preview.
  const joinNow = async (team: Team) => {
    await ensureTeamMembership(team.id, profile.id)
    const res = await fetch(
      `${API_BASE}/api/token?room=${encodeURIComponent('team:' + team.id)}` +
        `&identity=${encodeURIComponent(profile.id)}&name=${encodeURIComponent(profile.name)}`,
    )
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'token error')
    setPending({ team, token: data.token })
  }

  const enterTeam = async (team: Team) => {
    setError('')
    try {
      // Waiting room: if auto-approve is off and I'm not yet in the team, ask the host.
      const member = await isTeamMember(team.id, profile.id)
      if (team.auto_approve || member) {
        await joinNow(team)
      } else {
        const req = await requestToJoin(team, profile.id, profile.name)
        setWaiting({ team, requestId: req.id })
      }
    } catch (e) {
      setError((e as Error).message)
    }
  }

  // While waiting, watch my request; proceed on approval, surface a denial.
  useEffect(() => {
    if (!waiting) return
    const ch = supabase
      .channel(`req:${waiting.requestId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'meeting_requests', filter: `id=eq.${waiting.requestId}` },
        (p) => {
          const status = (p.new as { status: string }).status
          if (status === 'approved') {
            const team = waiting.team
            setWaiting(null)
            joinNow(team).catch((e) => setError((e as Error).message))
          } else if (status === 'denied') {
            setWaiting(null)
            setError('회의 입장이 거절되었어요.')
          }
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiting])

  // No group yet → simple onboarding to create/join.
  if (!activeGroup) {
    return (
      <div className="ws-empty">
        <div className="brand-lockup">
          <img className="brand-logo" src="/weavia-logo.png" alt="WEAVIA" />
          <h1 className="brand">WEAVIA</h1>
        </div>
        <p className="subtitle">첫 그룹을 만들거나 초대 코드로 참가하세요</p>
        <div className="ws-empty-actions">
          <input
            className="field"
            placeholder="새 그룹 이름 + Enter"
            value={newGroup}
            onChange={(e) => setNewGroup(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addGroup()}
          />
          <input
            className="field"
            placeholder="초대 링크 또는 코드 + Enter"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && joinGroup()}
          />
        </div>
        {error && <p className="error">{error}</p>}
        <button className="btn-ghost ws-empty-logout" onClick={onSignOut}>
          로그아웃
        </button>
      </div>
    )
  }

  return (
    <div className="app-shell">
      {/* Group rail */}
      <aside className="rail">
        {groups.map((g) => (
          <button
            key={g.id}
            className={`rail-group ${g.id === activeGroupId ? 'on' : ''}`}
            onClick={() => switchGroup(g.id)}
            title={g.name}
          >
            {g.name.slice(0, 2)}
          </button>
        ))}
        <div className="rail-add-wrap">
          <button className="rail-add" onClick={() => setRailMenu(true)} title="그룹 추가/참가">
            +
          </button>
        </div>
        <span className="rail-spacer" />
        <button className="rail-icon" onClick={onSignOut} title="로그아웃">
          <LogoutIcon />
        </button>
      </aside>

      {/* Team sidebar */}
      <aside className="sidebar">
        <div className="sidebar-head">
          <span className="sidebar-group">{activeGroup.name}</span>
          <NotificationsBell userId={profile.id} />
          {isOwner && (
            <button className="icon-btn small" onClick={() => setSettingsOpen(true)} title="그룹 설정">
              <SettingsIcon />
            </button>
          )}
        </div>
        <div className="sidebar-nav">
          <span className="sidebar-label">보기</span>
          {NAV.map((n) => {
            const Icon = n.icon
            return (
              <button
                key={n.key}
                className={`nav-item ${!active && !channelTeam && view === n.key ? 'on' : ''}`}
                onClick={() => goView(n.key)}
              >
                <Icon />
                {n.label}
              </button>
            )
          })}

          <span className="sidebar-label">팀 채널</span>
          {teams.map((t) => {
            const n = (presence[t.id] ?? []).length
            const muted = mutedTeams.has(t.id)
            return (
              <div key={t.id} className={`channel-row ${muted ? 'muted' : ''}`}>
                <button
                  className={`nav-item channel ${t.id === activeTeamId || (!active && channelTeam?.id === t.id) ? 'on' : ''}`}
                  onClick={() => openChannel(t)}
                >
                  <span className="hash">#</span>
                  <span className="channel-name">{t.name}</span>
                  {n > 0 && !muted && (
                    <span className="channel-live">
                      <span className="live-dot" />
                      {n}
                    </span>
                  )}
                </button>
                <button
                  className="channel-mute"
                  onClick={() => toggleMute(t.id)}
                  title={muted ? '알림 켜기' : '알림 음소거'}
                  aria-label={muted ? '알림 켜기' : '알림 음소거'}
                >
                  <BellOffIcon />
                </button>
              </div>
            )
          })}
          <input
            className="field channel-new"
            placeholder="+ 팀 만들기"
            value={newTeam}
            onChange={(e) => setNewTeam(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTeam()}
          />

          {members.filter((m) => m.user_id !== profile.id).length > 0 && (
            <>
              <span className="sidebar-label">다이렉트 메시지</span>
              {members
                .filter((m) => m.user_id !== profile.id)
                .map((m) => (
                  <button
                    key={m.user_id}
                    className={`nav-item dm-item ${dmPeer?.user_id === m.user_id ? 'on' : ''}`}
                    onClick={() => openDM(m)}
                  >
                    <span className="avatar sm">{(m.name || '?').slice(0, 2)}</span>
                    <span className="channel-name">{m.name}</span>
                  </button>
                ))}
            </>
          )}
        </div>

        <div className="user-card">
          <button className="user-avatar-btn" onClick={() => setStatusMenu((v) => !v)} title="상태 변경">
            <span className="avatar sm">{profile.name.slice(0, 2)}</span>
            <span className="status-dot" style={{ background: STATUS[status].color }} />
          </button>
          {statusMenu && (
            <>
              <div className="menu-catch" onClick={() => setStatusMenu(false)} />
              <div className="status-menu glass">
                {(Object.keys(STATUS) as Status[]).map((s) => (
                  <button key={s} className={status === s ? 'on' : ''} onClick={() => changeStatus(s)}>
                    <span className="status-dot" style={{ background: STATUS[s].color }} />
                    {STATUS[s].label}
                  </button>
                ))}
              </div>
            </>
          )}
          <button className="user-meta" onClick={() => setProfileOpen(true)} title="프로필 수정">
            <span className="user-name">{profile.name}</span>
            <span className="user-role">
              {STATUS[status].label} · {profile.language === 'en' ? 'English' : '한국어'}
            </span>
          </button>
          <button className="icon-btn small" onClick={() => setProfileOpen(true)} title="프로필 수정">
            <SettingsIcon />
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="content">
        {pending ? (
          <Prejoin
            teamName={pending.team.name}
            name={profile.name}
            onCancel={() => setPending(null)}
            onJoin={({ video, audio }) => {
              setActive({ team: pending.team, token: pending.token, video, audio })
              setPending(null)
            }}
          />
        ) : active ? (
          <RoomView
            key={active.team.id}
            serverUrl={serverUrl}
            token={active.token}
            name={profile.name}
            userId={profile.id}
            lang={profile.language}
            groupId={active.team.group_id}
            teamId={active.team.id}
            canHost={activeGroup.owner_id === profile.id}
            startVideo={active.video}
            startAudioOn={active.audio}
            onLeave={() => setActive(null)}
          />
        ) : channelTeam ? (
          <TeamChat
            key={channelTeam.id}
            groupId={activeGroup.id}
            teamId={channelTeam.id}
            teamName={channelTeam.name}
            userId={profile.id}
            userName={profile.name}
            onEnterMeeting={() => enterTeam(channelTeam)}
          />
        ) : dmPeer ? (
          <DMView
            key={dmPeer.user_id}
            groupId={activeGroup.id}
            meId={profile.id}
            meName={profile.name}
            peerId={dmPeer.user_id}
            peerName={dmPeer.name}
          />
        ) : view === 'docs' ? (
          <DocsView
            groupId={activeGroup.id}
            lang={profile.language}
            userId={profile.id}
            userName={profile.name}
          />
        ) : (
          <div className="board-wrap">
            <div className="board-head">
              <div>
                <h1 className="board-title">팀 보드</h1>
                <p className="board-sub">누가 어느 팀에 있는지 확인하고 바로 입장하세요.</p>
              </div>
            </div>
            {teams.length > 0 && (
              <MeetingSchedule
                groupId={activeGroup.id}
                teams={teams}
                userId={profile.id}
                onEnter={enterTeam}
              />
            )}
            <div className="board">
              {teams.map((t) => {
                const here = presence[t.id] ?? []
                return (
                  <button key={t.id} className="room-card" onClick={() => enterTeam(t)}>
                    <div className="rc-name">
                      <span className="hash">#</span>
                      {t.name}
                      {here.length > 0 ? (
                        <span className="rc-live">{here.length}명 참여 중</span>
                      ) : (
                        <span className="rc-idle">비어 있음</span>
                      )}
                    </div>
                    <div className="rc-avatars">
                      {here.slice(0, 5).map((name, i) => (
                        <span key={`${name}-${i}`} className="avatar sm" title={name}>
                          {name.slice(0, 2)}
                        </span>
                      ))}
                      {here.length > 5 && <span className="rc-more">+{here.length - 5}</span>}
                      {here.length === 0 && <span className="rc-empty">아직 아무도 없어요</span>}
                    </div>
                    <div className="rc-foot">입장하기</div>
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
          </div>
        )}
        {error && <p className="error board-error">{error}</p>}
      </main>

      {/* Mobile bottom tabs */}
      <nav className="mobile-tabs">
        {NAV.map((n) => {
          const Icon = n.icon
          return (
            <button
              key={n.key}
              className={!active && !channelTeam && view === n.key ? 'on' : ''}
              onClick={() => goView(n.key)}
            >
              <Icon />
              {n.key === 'board' ? '보드' : n.label}
            </button>
          )
        })}
        <button onClick={() => setProfileOpen(true)}>
          <PeopleIcon />
          프로필
        </button>
      </nav>

      {settingsOpen && (
        <GroupSettings
          group={activeGroup}
          teams={teams}
          meId={profile.id}
          onClose={() => setSettingsOpen(false)}
          onChanged={refreshAfterSettings}
        />
      )}
      {profileOpen && (
        <ProfileEdit profile={profile} onClose={() => setProfileOpen(false)} onSaved={onProfileChange} />
      )}

      {railMenu && (
        <div className="modal-backdrop" onClick={() => setRailMenu(false)}>
          <div
            className="glass modal group-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="그룹 추가·참가"
          >
            <div className="modal-head">
              <h2>그룹 추가 · 참가</h2>
              <button className="icon-btn small" onClick={() => setRailMenu(false)} aria-label="닫기">
                <CloseIcon />
              </button>
            </div>
            <section className="setting-group">
              <div className="section-title">새 그룹 만들기</div>
              <input
                className="field"
                placeholder="그룹 이름 + Enter"
                value={newGroup}
                autoFocus
                onChange={(e) => setNewGroup(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addGroup()}
              />
            </section>
            <section className="setting-group">
              <div className="section-title">초대로 참가</div>
              <input
                className="field"
                placeholder="초대 링크 또는 코드 + Enter"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && joinGroup()}
              />
            </section>
            {error && <p className="error">{error}</p>}
          </div>
        </div>
      )}

      {waiting && (
        <div className="modal-backdrop">
          <div className="glass modal wait-modal" role="dialog" aria-label="입장 승인 대기">
            <div className="wait-spinner" />
            <h2># {waiting.team.name} 입장 대기 중</h2>
            <p className="subtitle">호스트가 승인하면 자동으로 입장해요.</p>
            <button className="btn-mini ghost" onClick={() => setWaiting(null)}>
              취소
            </button>
          </div>
        </div>
      )}

      <ChatBot groupId={activeGroup.id} />
    </div>
  )
}
