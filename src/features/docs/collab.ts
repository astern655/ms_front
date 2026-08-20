import { supabase } from '../../lib/supabase'

export type DocComment = {
  id: string
  doc_id: string
  user_id: string
  author_name: string
  content: string
  created_at: string
}
export type DocVersion = {
  id: string
  doc_id: string
  title: string | null
  content: string | null
  created_by: string | null
  created_at: string
}

export async function listComments(docId: string): Promise<DocComment[]> {
  const { data, error } = await supabase
    .from('doc_comments')
    .select('*')
    .eq('doc_id', docId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as DocComment[]
}

export async function addComment(c: {
  docId: string
  groupId: string
  userId: string
  name: string
  content: string
}): Promise<void> {
  const { error } = await supabase.from('doc_comments').insert({
    doc_id: c.docId,
    group_id: c.groupId,
    user_id: c.userId,
    author_name: c.name,
    content: c.content,
  })
  if (error) throw error
}

export async function deleteComment(id: string): Promise<void> {
  const { error } = await supabase.from('doc_comments').delete().eq('id', id)
  if (error) throw error
}

export async function listVersions(docId: string): Promise<DocVersion[]> {
  const { data, error } = await supabase
    .from('doc_versions')
    .select('*')
    .eq('doc_id', docId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return data as DocVersion[]
}

export async function saveVersion(v: {
  docId: string
  groupId: string
  title: string
  content: string
  userId: string
}): Promise<void> {
  const { error } = await supabase.from('doc_versions').insert({
    doc_id: v.docId,
    group_id: v.groupId,
    title: v.title,
    content: v.content,
    created_by: v.userId,
  })
  if (error) throw error
}
