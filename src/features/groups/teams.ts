import { supabase } from '../../lib/supabase'

export type Group = { id: string; name: string; owner_id: string; invite_code: string | null }
export type Team = { id: string; group_id: string; name: string; auto_approve: boolean }
export type Member = { user_id: string; name: string; job_role: string | null; role: string }
export type MeetingRequest = {
  id: string
  team_id: string
  group_id: string
  user_id: string
  name: string
  status: string
  created_at: string
}

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

export async function isTeamMember(teamId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('team_members')
    .select('user_id')
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return !!data
}

export async function setAutoApprove(teamId: string, value: boolean): Promise<void> {
  const { error } = await supabase.from('teams').update({ auto_approve: value }).eq('id', teamId)
  if (error) throw error
}

// Guest (group member, not yet in the team) asks to join the meeting; host approves.
export async function requestToJoin(
  team: Team,
  userId: string,
  name: string,
): Promise<MeetingRequest> {
  const { data, error } = await supabase
    .from('meeting_requests')
    .insert({ team_id: team.id, group_id: team.group_id, user_id: userId, name, status: 'pending' })
    .select()
    .single()
  if (error) throw error
  return data as MeetingRequest
}

export async function listPendingRequests(teamId: string): Promise<MeetingRequest[]> {
  const { data, error } = await supabase
    .from('meeting_requests')
    .select('*')
    .eq('team_id', teamId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as MeetingRequest[]
}

export async function resolveRequest(id: string, status: 'approved' | 'denied'): Promise<void> {
  const { error } = await supabase.from('meeting_requests').update({ status }).eq('id', id)
  if (error) throw error
}

export async function getGroupMembers(groupId: string): Promise<Member[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('user_id, role, profiles(name, job_role)')
    .eq('group_id', groupId)
  if (error) throw error
  return (data ?? []).map((r) => {
    const row = r as { user_id: string; role?: string; profiles?: { name?: string; job_role?: string | null } }
    const p = row.profiles
    return {
      user_id: row.user_id,
      name: p?.name ?? '?',
      job_role: p?.job_role ?? null,
      role: row.role ?? 'member',
    }
  })
}

export async function setMemberRole(groupId: string, userId: string, role: string): Promise<void> {
  const { error } = await supabase
    .from('group_members')
    .update({ role })
    .eq('group_id', groupId)
    .eq('user_id', userId)
  if (error) throw error
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
