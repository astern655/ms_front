import { supabase } from '../../lib/supabase'

export type Message = {
  id: string
  group_id: string
  team_id: string | null
  user_id: string
  author_name: string
  content: string
  parent_id: string | null
  pinned: boolean
  mentions: string[]
  created_at: string
}
export type Reaction = { message_id: string; user_id: string; emoji: string }

// Upload a chat image to the public bucket, return its public URL.
export async function uploadChatImage(teamId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'png'
  const path = `chat/${teamId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage.from('doc-images').upload(path, file, {
    contentType: file.type || 'image/png',
    upsert: false,
  })
  if (error) throw error
  return supabase.storage.from('doc-images').getPublicUrl(path).data.publicUrl
}

export async function listMessages(teamId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: true })
    .limit(200)
  if (error) throw error
  return data as Message[]
}

export async function sendMessage(m: {
  groupId: string
  teamId: string
  userId: string
  name: string
  content: string
  mentions?: string[]
  parentId?: string | null
}): Promise<void> {
  const { error } = await supabase.from('messages').insert({
    group_id: m.groupId,
    team_id: m.teamId,
    user_id: m.userId,
    author_name: m.name,
    content: m.content,
    mentions: m.mentions ?? [],
    parent_id: m.parentId ?? null,
  })
  if (error) throw error
}

// Stable DM channel key for a pair of users (order-independent).
export function dmKeyFor(a: string, b: string): string {
  return [a, b].sort().join(':')
}

export async function listDM(dmKey: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('dm_key', dmKey)
    .order('created_at', { ascending: true })
    .limit(200)
  if (error) throw error
  return data as Message[]
}

export async function sendDM(m: {
  groupId: string
  dmKey: string
  userId: string
  name: string
  content: string
}): Promise<void> {
  const { error } = await supabase.from('messages').insert({
    group_id: m.groupId,
    dm_key: m.dmKey,
    user_id: m.userId,
    author_name: m.name,
    content: m.content,
  })
  if (error) throw error
}

export async function deleteMessage(id: string): Promise<void> {
  const { error } = await supabase.from('messages').delete().eq('id', id)
  if (error) throw error
}

export async function setPinned(id: string, pinned: boolean): Promise<void> {
  const { error } = await supabase.from('messages').update({ pinned }).eq('id', id)
  if (error) throw error
}

export async function listReactions(messageIds: string[]): Promise<Reaction[]> {
  if (messageIds.length === 0) return []
  const { data, error } = await supabase
    .from('message_reactions')
    .select('*')
    .in('message_id', messageIds)
  if (error) throw error
  return data as Reaction[]
}

export async function toggleReaction(
  messageId: string,
  userId: string,
  emoji: string,
  has: boolean,
): Promise<void> {
  if (has) {
    await supabase
      .from('message_reactions')
      .delete()
      .match({ message_id: messageId, user_id: userId, emoji })
  } else {
    await supabase.from('message_reactions').insert({ message_id: messageId, user_id: userId, emoji })
  }
}

// Notify mentioned users (RLS allows authenticated insert into notifications).
export async function notifyMentions(
  userIds: string[],
  fromName: string,
  preview: string,
): Promise<void> {
  if (userIds.length === 0) return
  await supabase.from('notifications').insert(
    userIds.map((uid) => ({
      user_id: uid,
      kind: 'mention',
      title: `${fromName}님이 회의에서 멘션했어요`,
      body: preview.slice(0, 120),
    })),
  )
}
