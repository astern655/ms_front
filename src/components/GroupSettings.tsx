import { useEffect, useState } from 'react'
import {
  getGroupMembers,
  removeGroupMember,
  renameGroup,
  deleteTeam,
  type Group,
  type Team,
  type Member,
} from '../lib/teams'
import { CloseIcon } from './icons'

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
      <div className="glass modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="그룹 설정">
        <div className="modal-head">
          <h2>그룹 설정</h2>
          <button className="icon-btn small" onClick={onClose} aria-label="닫기">
            <CloseIcon />
          </button>
        </div>

        <section className="setting-group">
          <div className="section-title">그룹 이름</div>
          <div className="row">
            <input className="field" style={{ flex: 1 }} value={name} onChange={(e) => setName(e.target.value)} />
            <button className="btn-mini" onClick={saveName} disabled={!name.trim() || name === group.name}>
              저장
            </button>
          </div>
        </section>

        <section className="setting-group">
          <div className="section-title">초대 링크</div>
          <div className="invite-field">
            <span className="invite-link">{inviteLink || '—'}</span>
            <button className="btn-mini" onClick={copyLink}>
              {copied ? '복사됨' : '링크 복사'}
            </button>
          </div>
          <p className="ws-hint" style={{ padding: 0 }}>이 링크를 공유하면 그룹에 참가합니다.</p>
        </section>

        <section className="setting-group">
          <div className="section-title">멤버 · {members.length}</div>
          {members.map((m) => (
            <div key={m.user_id} className="list-row">
              <span className="member-row-left">
                <span className="avatar sm">{(m.name || '?').slice(0, 2)}</span>
                <span className="name">
                  {m.name}
                  {m.job_role && m.user_id !== group.owner_id ? ` · ${m.job_role}` : ''}
                </span>
                {m.user_id === group.owner_id && <span className="role-chip">대표</span>}
              </span>
              {m.user_id !== group.owner_id && m.user_id !== meId && (
                <button className="danger-btn" onClick={() => kick(m.user_id)}>
                  내보내기
                </button>
              )}
            </div>
          ))}
        </section>

        <section className="setting-group">
          <div className="section-title">팀 · {teams.length}</div>
          {teams.map((t) => (
            <div key={t.id} className="list-row">
              <span className="member-row-left">
                <span className="hash">#</span>
                <span className="name">{t.name}</span>
              </span>
              <button className="danger-btn" onClick={() => removeTeam(t.id)}>
                삭제
              </button>
            </div>
          ))}
          {teams.length === 0 && <p className="ws-hint" style={{ padding: 0 }}>팀이 없습니다.</p>}
        </section>

        {error && <p className="error">{error}</p>}
      </div>
    </div>
  )
}
