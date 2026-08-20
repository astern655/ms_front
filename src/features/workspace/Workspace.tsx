import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { RoomView } from '../meeting/RoomView'
import { Prejoin } from '../meeting/Prejoin'
import { apiFetch } from '../../lib/api'
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
import { useT } from '../../lib/i18n'

const serverUrl =
  (import.meta.env.VITE_LIVEKIT_URL as string | undefined) ??
  'wss://ms-hack-ly6rx40h.livekit.cloud'

type Profile = { id: string; name: string; language: string; job_role?: string | null }
type View = 'board' | 'docs'

const NAV: { key: View; labelKo: string; labelEn: string; icon: () => ReactElement }[] = [
  { key: 'board', labelKo: '팀 보드', labelEn: 'Team board', icon: BoardIcon },
  { key: 'docs', labelKo: '문서', labelEn: 'Docs', icon: DocIcon },
]

type Status = 'online' | 'away' | 'dnd'
const STATUS: Record<Status, { labelKo: string; labelEn: string; color: string }> = {
  online: { labelKo: '온라인', labelEn: 'Online', color: '#30d158' },
  away: { labelKo: '자리 비움', labelEn: 'Away', color: '#ffcf3f' },
  dnd: { labelKo: '방해 금지', labelEn: 'Do not disturb', color: '#ff453a' },
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
  const t = useT()

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
    const res = await apiFetch(
      `/api/token?room=${encodeURIComponent('team:' + team.id)}` +
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
            setError(t('회의 입장이 거절되었어요.', 'Meeting entry was declined.'))
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
        <p className="subtitle">{t('첫 그룹을 만들거나 초대 코드로 참가하세요', 'Create your first group or join with an invite code')}</p>
        <div className="ws-empty-actions">
          <input
            className="field"
            placeholder={t('새 그룹 이름 + Enter', 'New group name + Enter')}
            value={newGroup}
            onChange={(e) => setNewGroup(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addGroup()}
          />
          <input
            className="field"
            placeholder={t('초대 링크 또는 코드 + Enter', 'Invite link or code + Enter')}
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && joinGroup()}
          />
        </div>
        {error && <p className="error">{error}</p>}
        <button className="btn-ghost ws-empty-logout" onClick={onSignOut}>
          {t('로그아웃', 'Log out')}
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
          <button className="rail-add" onClick={() => setRailMenu(true)} title={t('그룹 추가/참가', 'Add/join group')}>
            +
          </button>
        </div>
        <span className="rail-spacer" />
        <button className="rail-icon" onClick={onSignOut} title={t('로그아웃', 'Log out')}>
          <LogoutIcon />
        </button>
      </aside>

      {/* Team sidebar */}
      <aside className="sidebar">
        <div className="sidebar-head">
          <span className="sidebar-group">{activeGroup.name}</span>
          <NotificationsBell userId={profile.id} />
          {isOwner && (
            <button className="icon-btn small" onClick={() => setSettingsOpen(true)} title={t('그룹 설정', 'Group settings')}>
              <SettingsIcon />
            </button>
          )}
        </div>
        <div className="sidebar-nav">
          <span className="sidebar-label">{t('보기', 'View')}</span>
          {NAV.map((n) => {
            const Icon = n.icon
            return (
              <button
                key={n.key}
                className={`nav-item ${!active && !channelTeam && view === n.key ? 'on' : ''}`}
                onClick={() => goView(n.key)}
              >
                <Icon />
                {t(n.labelKo, n.labelEn)}
              </button>
            )
          })}

          <span className="sidebar-label">{t('팀 채널', 'Team channels')}</span>
          {teams.map((team) => {
            const n = (presence[team.id] ?? []).length
            const muted = mutedTeams.has(team.id)
            return (
              <div key={team.id} className={`channel-row ${muted ? 'muted' : ''}`}>
                <button
                  className={`nav-item channel ${team.id === activeTeamId || (!active && channelTeam?.id === team.id) ? 'on' : ''}`}
                  onClick={() => openChannel(team)}
                >
                  <span className="hash">#</span>
                  <span className="channel-name">{team.name}</span>
                  {n > 0 && !muted && (
                    <span className="channel-live">
                      <span className="live-dot" />
                      {n}
                    </span>
                  )}
                </button>
                <button
                  className="channel-mute"
                  onClick={() => toggleMute(team.id)}
                  title={muted ? t('알림 켜기', 'Turn on notifications') : t('알림 음소거', 'Mute notifications')}
                  aria-label={muted ? t('알림 켜기', 'Turn on notifications') : t('알림 음소거', 'Mute notifications')}
                >
                  <BellOffIcon />
                </button>
              </div>
            )
          })}
          <input
            className="field channel-new"
            placeholder={t('+ 팀 만들기', '+ New team')}
            value={newTeam}
            onChange={(e) => setNewTeam(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTeam()}
          />

          {members.filter((m) => m.user_id !== profile.id).length > 0 && (
            <>
              <span className="sidebar-label">{t('다이렉트 메시지', 'Direct messages')}</span>
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
          <button className="user-avatar-btn" onClick={() => setStatusMenu((v) => !v)} title={t('상태 변경', 'Change status')}>
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
                    {t(STATUS[s].labelKo, STATUS[s].labelEn)}
                  </button>
                ))}
              </div>
            </>
          )}
          <button className="user-meta" onClick={() => setProfileOpen(true)} title={t('프로필 수정', 'Edit profile')}>
            <span className="user-name">{profile.name}</span>
            <span className="user-role">
              {t(STATUS[status].labelKo, STATUS[status].labelEn)} · {profile.language === 'en' ? 'English' : '한국어'}
            </span>
          </button>
          <button className="icon-btn small" onClick={() => setProfileOpen(true)} title={t('프로필 수정', 'Edit profile')}>
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
                <h1 className="board-title">{t('팀 보드', 'Team board')}</h1>
                <p className="board-sub">{t('누가 어느 팀에 있는지 확인하고 바로 입장하세요.', 'See who is in which team and jump right in.')}</p>
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
              {teams.map((team) => {
                const here = presence[team.id] ?? []
                return (
                  <button key={team.id} className="room-card" onClick={() => enterTeam(team)}>
                    <div className="rc-name">
                      <span className="hash">#</span>
                      {team.name}
                      {here.length > 0 ? (
                        <span className="rc-live">{t(`${here.length}명 참여 중`, `${here.length} here`)}</span>
                      ) : (
                        <span className="rc-idle">{t('비어 있음', 'Empty')}</span>
                      )}
                    </div>
                    <div className="rc-avatars">
                      {here.slice(0, 5).map((name, i) => (
                        <span key={`${name}-${i}`} className="avatar sm" title={name}>
                          {name.slice(0, 2)}
                        </span>
                      ))}
                      {here.length > 5 && <span className="rc-more">+{here.length - 5}</span>}
                      {here.length === 0 && <span className="rc-empty">{t('아직 아무도 없어요', 'No one here yet')}</span>}
                    </div>
                    <div className="rc-foot">{t('입장하기', 'Join')}</div>
                  </button>
                )
              })}
              <div className="room-card new">
                <div className="rc-name">{t('새 팀', 'New team')}</div>
                <input
                  className="field create-input"
                  placeholder={t('팀 이름 + Enter', 'Team name + Enter')}
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
              {n.key === 'board' ? t('보드', 'Board') : t(n.labelKo, n.labelEn)}
            </button>
          )
        })}
        <button onClick={() => setProfileOpen(true)}>
          <PeopleIcon />
          {t('프로필', 'Profile')}
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
            aria-label={t('그룹 추가·참가', 'Add/join group')}
          >
            <div className="modal-head">
              <h2>{t('그룹 추가 · 참가', 'Add or join group')}</h2>
              <button className="icon-btn small" onClick={() => setRailMenu(false)} aria-label={t('닫기', 'Close')}>
                <CloseIcon />
              </button>
            </div>
            <section className="setting-group">
              <div className="section-title">{t('새 그룹 만들기', 'Create new group')}</div>
              <input
                className="field"
                placeholder={t('그룹 이름 + Enter', 'Group name + Enter')}
                value={newGroup}
                autoFocus
                onChange={(e) => setNewGroup(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addGroup()}
              />
            </section>
            <section className="setting-group">
              <div className="section-title">{t('초대로 참가', 'Join with invite')}</div>
              <input
                className="field"
                placeholder={t('초대 링크 또는 코드 + Enter', 'Invite link or code + Enter')}
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
          <div className="glass modal wait-modal" role="dialog" aria-label={t('입장 승인 대기', 'Waiting for approval')}>
            <div className="wait-spinner" />
            <h2>{t(`# ${waiting.team.name} 입장 대기 중`, `# Waiting to join ${waiting.team.name}`)}</h2>
            <p className="subtitle">{t('호스트가 승인하면 자동으로 입장해요.', 'You will join automatically once the host approves.')}</p>
            <button className="btn-mini ghost" onClick={() => setWaiting(null)}>
              {t('취소', 'Cancel')}
            </button>
          </div>
        </div>
      )}

      <ChatBot groupId={activeGroup.id} />
    </div>
  )
}
