import { supabase } from '../../lib/supabase'

export type ScheduledMeeting = {
  id: string
  team_id: string
  group_id: string
  title: string
  start_at: string
  created_by: string | null
  created_at: string
}

// Upcoming meetings for a group (from now), soonest first.
export async function listUpcoming(groupId: string, fromIso: string): Promise<ScheduledMeeting[]> {
  const { data, error } = await supabase
    .from('meeting_schedule')
    .select('*')
    .eq('group_id', groupId)
    .gte('start_at', fromIso)
    .order('start_at', { ascending: true })
    .limit(20)
  if (error) throw error
  return data as ScheduledMeeting[]
}

export async function addMeeting(m: {
  groupId: string
  teamId: string
  title: string
  startAt: string
  userId: string
}): Promise<void> {
  const { error } = await supabase.from('meeting_schedule').insert({
    group_id: m.groupId,
    team_id: m.teamId,
    title: m.title,
    start_at: m.startAt,
    created_by: m.userId,
  })
  if (error) throw error
}

export async function deleteMeeting(id: string): Promise<void> {
  const { error } = await supabase.from('meeting_schedule').delete().eq('id', id)
  if (error) throw error
}
