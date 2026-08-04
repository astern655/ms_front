import { supabase } from './supabase'

export type Group = { id: string; name: string; owner_id: string; invite_code: string | null }
export type Team = { id: string; group_id: string; name: string }
export type Member = { user_id: string; name: string; job_role: string | null }

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

export async function getGroupMembers(groupId: string): Promise<Member[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('user_id, profiles(name, job_role)')
    .eq('group_id', groupId)
  if (error) throw error
  return (data ?? []).map((r) => {
    const p = (r as { profiles?: { name?: string; job_role?: string | null } }).profiles
    return { user_id: (r as { user_id: string }).user_id, name: p?.name ?? '?', job_role: p?.job_role ?? null }
  })
}

export async function removeGroupMember(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId)
  if (error) throw error
}

export async function renameGroup(groupId: string, name: string): Promise<void> {
  const { error } = await supabase.from('groups').update({ name }).eq('id', groupId)
  if (error) throw error
}

export async function deleteTeam(teamId: string): Promise<void> {
  const { error } = await supabase.from('teams').delete().eq('id', teamId)
  if (error) throw error
}

export async function joinGroupByCode(code: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_group_by_code', { code: code.trim() })
  if (error) throw error
  return data as string
}

export async function updateProfile(
  id: string,
  fields: { name: string; language: string; job_role: string },
): Promise<void> {
  const { error } = await supabase.from('profiles').update(fields).eq('id', id)
  if (error) throw error
}
