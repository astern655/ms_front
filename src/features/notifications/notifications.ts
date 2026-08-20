import { supabase } from '../../lib/supabase'

export type Notification = {
  id: string
  user_id: string
  kind: string
  title: string | null
  body: string | null
  link: string | null
  read: boolean
  created_at: string
}

export async function listNotifications(userId: string): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return data as Notification[]
}

export async function markAllRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false)
  if (error) throw error
}
