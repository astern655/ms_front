import * as Y from 'yjs'
import { Awareness } from 'y-protocols/awareness'
import { supabase } from '../../lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

// Compact base64 for the text column.
function b64encode(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)))
  }
  return btoa(s)
}
function b64decode(str: string): Uint8Array {
  const bin = atob(str)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

// Yjs provider that syncs document updates through an append-only table over
// Supabase postgres_changes (the transport already proven in this app). Each local
// Yjs update is appended as a row; a late joiner backfills by reading the log.
// Awareness is created locally to satisfy BlockNote's collaboration API (no remote cursors).
// ponytail: append-only update log, no compaction — fine for a hackathon; snapshot+truncate if it grows.
// Any DB failure (e.g. table not created yet) is swallowed so the editor still works solo.
export class SupabaseYProvider {
  awareness: Awareness
  private channel: RealtimeChannel

  constructor(docId: string, groupId: string, doc: Y.Doc) {
    this.awareness = new Awareness(doc)

    // Append each local update to the log (skip updates we applied from remote).
    doc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin === this) return
      supabase
        .from('doc_yjs')
        .insert({ doc_id: docId, group_id: groupId, update_b64: b64encode(update) })
        .then(({ error }) => {
          if (error) console.warn('[coedit] append failed', error.message)
        })
    })

    // Backfill existing updates, then subscribe for new ones.
    supabase
      .from('doc_yjs')
      .select('update_b64')
      .eq('doc_id', docId)
      .order('id', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.warn('[coedit] backfill failed', error.message)
          return
        }
        for (const row of data ?? []) {
          try {
            Y.applyUpdate(doc, b64decode((row as { update_b64: string }).update_b64), this)
          } catch {
            /* skip a corrupt row */
          }
        }
      })

    // Unique topic per instance — postgres_changes filters by doc_id, so the topic name
    // need not be shared; a unique name avoids colliding with a stale channel (HMR/StrictMode).
    this.channel = supabase
      .channel(`docyjs:${docId}:${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'doc_yjs', filter: `doc_id=eq.${docId}` },
        (p) => {
          // applyUpdate is idempotent, so re-applying our own row is a no-op.
          try {
            Y.applyUpdate(doc, b64decode((p.new as { update_b64: string }).update_b64), this)
          } catch {
            /* ignore */
          }
        },
      )
      .subscribe()
  }

  destroy() {
    this.awareness.destroy()
    supabase.removeChannel(this.channel)
  }
}
