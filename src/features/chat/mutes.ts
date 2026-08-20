import { supabase } from '../../lib/supabase'

export async function listMutedTeams(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('channel_mutes')
    .select('team_id')
    .eq('user_id', userId)
  if (error) throw error
  return new Set((data as { team_id: string }[]).map((r) => r.team_id))
}

export async function setMuted(userId: string, teamId: string, muted: boolean): Promise<void> {
  if (muted) {
    const { error } = await supabase.from('channel_mutes').insert({ user_id: userId, team_id: teamId })
    if (error && error.code !== '23505') throw error // ignore duplicate
  } else {
    const { error } = await supabase
      .from('channel_mutes')
      .delete()
      .eq('user_id', userId)
      .eq('team_id', teamId)
    if (error) throw error
  }
}
