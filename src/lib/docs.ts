import { supabase } from './supabase'

export type DocScope = 'personal' | 'team' | 'meeting' | 'group'

export type Doc = {
  id: string
  group_id: string
  title: string
  content: string
  scope: DocScope
  parent_id: string | null
  updated_at: string
}

export async function listDocs(groupId: string): Promise<Doc[]> {
  const { data, error } = await supabase
    .from('docs')
    .select('*')
    .eq('group_id', groupId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data as Doc[]
}

export async function createDoc(
  groupId: string,
  scope: DocScope = 'personal',
  parentId: string | null = null,
): Promise<Doc> {
  const { data, error } = await supabase
    .from('docs')
    .insert({ group_id: groupId, scope, parent_id: parentId })
    .select()
    .single()
  if (error) throw error
  return data as Doc
}

export async function saveDoc(
  id: string,
  fields: { title?: string; content?: string; scope?: DocScope },
): Promise<void> {
  const { error } = await supabase
    .from('docs')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function deleteDoc(id: string): Promise<void> {
  const { error } = await supabase.from('docs').delete().eq('id', id)
  if (error) throw error
}
