import { useEffect, useState } from 'react'
import type { Team } from '../groups/teams'
import { listUpcoming, addMeeting, deleteMeeting, type ScheduledMeeting } from './schedule'

export function MeetingSchedule({
  groupId,
  teams,
  userId,
  onEnter,
}: {
  groupId: string
  teams: Team[]
  userId: string
  onEnter: (team: Team) => void
}) {
  const [items, setItems] = useState<ScheduledMeeting[]>([])
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [teamId, setTeamId] = useState('')
  const [startAt, setStartAt] = useState('')
  const [error, setError] = useState('')

  const load = () => {
    listUpcoming(groupId, new Date().toISOString())
      .then(setItems)
      .catch((e) => setError((e as Error).message))
  }
  useEffect(load, [groupId])

  const submit = async () => {
    const t = title.trim()
    const team = teamId || teams[0]?.id
    if (!t || !team || !startAt) return
    try {
      await addMeeting({ groupId, teamId: team, title: t, startAt: new Date(startAt).toISOString(), userId })
      setTitle('')
      setStartAt('')
      setOpen(false)
      load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const remove = async (id: string) => {
    await deleteMeeting(id).catch(() => {})
    load()
  }

  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? '팀'

  return (
    <section className="sched">
      <div className="sched-head">
        <span className="sched-title">예정된 회의</span>
        <button className="btn-mini" onClick={() => setOpen((v) => !v)}>
          {open ? '취소' : '+ 회의 예약'}
        </button>
      </div>

      {open && (
        <div className="sched-form glass">
          <input
            className="field"
            placeholder="회의 제목"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className="sched-form-row">
            <select className="field" value={teamId || teams[0]?.id || ''} onChange={(e) => setTeamId(e.target.value)}>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  # {t.name}
                </option>
              ))}
            </select>
            <input
              className="field"
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
            />
            <button className="btn-mini" onClick={submit} disabled={!title.trim() || !startAt}>
              예약
            </button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <p className="sched-empty">예정된 회의가 없어요.</p>
      ) : (
        <div className="sched-list">
          {items.map((m) => {
            const team = teams.find((t) => t.id === m.team_id)
            return (
              <div key={m.id} className="sched-item">
                <div className="sched-when">
                  {new Date(m.start_at).toLocaleString('ko-KR', {
                    month: 'short',
                    day: 'numeric',
                    weekday: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
                <div className="sched-meta">
                  <span className="sched-name">{m.title}</span>
                  <span className="sched-team"># {teamName(m.team_id)}</span>
                </div>
                <div className="sched-actions">
                  {team && (
                    <button className="btn-mini" onClick={() => onEnter(team)}>
                      입장
                    </button>
                  )}
                  <button className="icon-btn small" onClick={() => remove(m.id)} aria-label="삭제" title="삭제">
                    ✕
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  )
}
