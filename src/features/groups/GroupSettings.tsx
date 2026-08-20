import { useEffect, useState } from 'react'
import {
  getGroupMembers,
  removeGroupMember,
  setMemberRole,
  setAutoApprove,
  renameGroup,
  deleteTeam,
  type Group,
  type Team,
  type Member,
} from './teams'
import { CloseIcon } from '../../components/ui/icons'
import { useT } from '../../lib/i18n'

export function GroupSettings({
  group,
  teams,
  meId,
  onClose,
  onChanged,
}: {
  group: Group
  teams: Team[]
  meId: string
  onClose: () => void
  onChanged: () => void
}) {
  const [name, setName] = useState(group.name)
  const [members, setMembers] = useState<Member[]>([])
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const t = useT()

  const loadMembers = () => {
    getGroupMembers(group.id).then(setMembers).catch((e) => setError((e as Error).message))
  }
  useEffect(loadMembers, [group.id])

  const saveName = async () => {
    try {
      await renameGroup(group.id, name.trim())
      onChanged()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const inviteLink = group.invite_code
    ? `${window.location.origin}/?invite=${group.invite_code}`
    : ''
  const copyLink = async () => {
    if (!inviteLink) return
    await navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  const kick = async (userId: string) => {
    try {
      await removeGroupMember(group.id, userId)
      loadMembers()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const isOwner = meId === group.owner_id

  const changeRole = async (userId: string, role: string) => {
    try {
      await setMemberRole(group.id, userId, role)
      loadMembers()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const removeTeam = async (teamId: string) => {
    try {
      await deleteTeam(teamId)
      onChanged()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="glass modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t('그룹 설정', 'Group settings')}>
        <div className="modal-head">
          <h2>{t('그룹 설정', 'Group settings')}</h2>
          <button className="icon-btn small" onClick={onClose} aria-label={t('닫기', 'Close')}>
            <CloseIcon />
          </button>
        </div>

        <section className="setting-group">
          <div className="section-title">{t('그룹 이름', 'Group name')}</div>
          <div className="row">
            <input className="field" style={{ flex: 1 }} value={name} onChange={(e) => setName(e.target.value)} />
            <button className="btn-mini" onClick={saveName} disabled={!name.trim() || name === group.name}>
              {t('저장', 'Save')}
            </button>
          </div>
        </section>

        <section className="setting-group">
          <div className="section-title">{t('초대 링크', 'Invite link')}</div>
          <div className="invite-field">
            <span className="invite-link">{inviteLink || '—'}</span>
            <button className="btn-mini" onClick={copyLink}>
              {copied ? t('복사됨', 'Copied') : t('링크 복사', 'Copy link')}
            </button>
          </div>
          <p className="ws-hint" style={{ padding: 0 }}>{t('이 링크를 공유하면 그룹에 참가합니다.', 'Sharing this link lets others join the group.')}</p>
        </section>

        <section className="setting-group">
          <div className="section-title">{t('멤버', 'Members')} · {members.length}</div>
          {members.map((m) => {
            const isMemberOwner = m.user_id === group.owner_id
            const isAdmin = m.role === 'admin'
            return (
              <div key={m.user_id} className="list-row">
                <span className="member-row-left">
                  <span className="avatar sm">{(m.name || '?').slice(0, 2)}</span>
                  <span className="name">
                    {m.name}
                    {m.job_role && !isMemberOwner ? ` · ${m.job_role}` : ''}
                  </span>
                  {isMemberOwner ? (
                    <span className="role-chip">{t('대표', 'Owner')}</span>
                  ) : (
                    isAdmin && <span className="role-chip admin">{t('관리자', 'Admin')}</span>
                  )}
                </span>
                {isOwner && !isMemberOwner && (
                  <span className="row-actions">
                    <button className="btn-mini ghost" onClick={() => changeRole(m.user_id, isAdmin ? 'member' : 'admin')}>
                      {isAdmin ? t('관리자 해제', 'Remove admin') : t('관리자 지정', 'Make admin')}
                    </button>
                    <button className="danger-btn" onClick={() => kick(m.user_id)}>
                      {t('내보내기', 'Remove')}
                    </button>
                  </span>
                )}
              </div>
            )
          })}
        </section>

        <section className="setting-group">
          <div className="section-title">{t('팀', 'Teams')} · {teams.length}</div>
          {teams.map((team) => (
            <div key={team.id} className="list-row">
              <span className="member-row-left">
                <span className="hash">#</span>
                <span className="name">{team.name}</span>
              </span>
              <span className="row-actions">
                <button
                  className={`btn-mini ghost ${!team.auto_approve ? 'on' : ''}`}
                  onClick={async () => {
                    try {
                      await setAutoApprove(team.id, !team.auto_approve)
                      onChanged()
                    } catch (e) {
                      setError((e as Error).message)
                    }
                  }}
                  title={t('켜면 비팀원 입장 시 호스트 승인을 받습니다', 'When on, non-members need host approval to join')}
                >
                  {team.auto_approve ? t('대기실 꺼짐', 'Waiting room off') : t('대기실 켜짐', 'Waiting room on')}
                </button>
                <button className="danger-btn" onClick={() => removeTeam(team.id)}>
                  {t('삭제', 'Delete')}
                </button>
              </span>
            </div>
          ))}
          {teams.length === 0 && <p className="ws-hint" style={{ padding: 0 }}>{t('팀이 없습니다.', 'No teams yet.')}</p>}
        </section>

        {error && <p className="error">{error}</p>}
      </div>
    </div>
  )
}
