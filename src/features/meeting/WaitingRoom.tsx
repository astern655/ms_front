import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { listPendingRequests, resolveRequest, type MeetingRequest } from '../groups/teams'

// Host-side waiting room: shows pending join requests for the current meeting and
// lets a member approve/deny. Only team members can read these rows (RLS).
export function WaitingRoom({ teamId }: { teamId: string }) {
  const [pending, setPending] = useState<MeetingRequest[]>([])

  useEffect(() => {
    let alive = true
    const load = () =>
      listPendingRequests(teamId)
        .then((r) => alive && setPending(r))
        .catch(() => {})
    load()
    const ch = supabase
      .channel(`waitroom:${teamId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'meeting_requests', filter: `team_id=eq.${teamId}` },
        load,
      )
      .subscribe()
    return () => {
      alive = false
      supabase.removeChannel(ch)
    }
  }, [teamId])

  if (pending.length === 0) return null

  return (
    <div className="waitroom glass">
      <div className="waitroom-head">입장 요청 {pending.length}</div>
      {pending.map((r) => (
        <div key={r.id} className="waitroom-item">
          <span className="avatar sm">{(r.name || '?').slice(0, 2)}</span>
          <span className="waitroom-name">{r.name}</span>
          <button className="btn-mini" onClick={() => resolveRequest(r.id, 'approved').catch(() => {})}>
            승인
          </button>
          <button className="btn-mini ghost" onClick={() => resolveRequest(r.id, 'denied').catch(() => {})}>
            거절
          </button>
        </div>
      ))}
    </div>
  )
}
