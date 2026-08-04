import { supabase } from './supabase'

export type Group = { id: string; name: string; owner_id: string }
export type Team = { id: string; group_id: string; name: string }

export async function listGroups(): Promise<Group[]> {
  const { data, error } = await supabase.from('groups').select('*').order('created_at')
  if (error) throw error
  return data as Group[]
}

export async function createGroup(name: string, userId: string): Promise<Group> {
  const { data, error } = await supabase
    .from('groups')
    .insert({ name, owner_id: userId })
    .select()
    .single()
  if (error) throw error
  await supabase.from('group_members').insert({ group_id: data.id, user_id: userId })
  return data as Group
}

export async function listTeams(groupId: string): Promise<Team[]> {
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at')
  if (error) throw error
  return data as Team[]
}

export async function createTeam(groupId: string, name: string, userId: string): Promise<Team> {
  const { data, error } = await supabase
    .from('teams')
    .insert({ group_id: groupId, name })
    .select()
    .single()
  if (error) throw error
  await supabase.from('team_members').insert({ team_id: data.id, user_id: userId, role: 'lead' })
  return data as Team
}

// Add self as a plain member when entering a team (keeps an existing 'lead' role intact).
export async function ensureTeamMembership(teamId: string, userId: string): Promise<void> {
  await supabase
    .from('team_members')
    .upsert(
      { team_id: teamId, user_id: userId, role: 'member' },
      { onConflict: 'team_id,user_id', ignoreDuplicates: true },
    )
}
