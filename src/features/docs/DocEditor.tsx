import { useEffect, useMemo, useRef } from 'react'
import * as Y from 'yjs'
import type { PartialBlock } from '@blocknote/core'
import { ko, en } from '@blocknote/core/locales'
import { useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/mantine'
import '@blocknote/mantine/style.css'
import { SupabaseYProvider } from './yjsSupabase'
import { useT } from '../../lib/i18n'

function parseContent(content: string): PartialBlock[] | undefined {
  if (!content) return undefined
  try {
    const parsed = JSON.parse(content)
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as PartialBlock[]
    return undefined
  } catch {
    // Legacy plain-text doc → one paragraph.
    return [{ type: 'paragraph', content }]
  }
}

const CURSOR_COLORS = ['#1786c8', '#5bc6f0', '#30d158', '#ff9f0a', '#ff453a', '#bf5af2', '#64d2ff']
function colorFor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return CURSOR_COLORS[h % CURSOR_COLORS.length]
}

// Notion-style block editor with live co-editing (Yjs over Supabase Realtime).
// Durable content is still saved as BlockNote JSON in docs.content via onChange.
// Remount (via key) to switch docs.
export function DocEditor({
  content,
  onChange,
  lang = 'ko',
  docId,
  groupId,
  userName,
}: {
  content: string
  onChange: (json: string) => void
  lang?: string
  docId?: string
  groupId?: string
  userName?: string
}) {
  const t = useT()
  const displayName = userName || t('익명', 'Anonymous')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // Gate persistence until the shared doc has seeded/backfilled — prevents the empty
  // pre-seed editor from overwriting stored content (data loss).
  const ready = useRef(false)

  // One Y.Doc + provider per mount (DocsView remounts per doc via key).
  const collab = useMemo(() => {
    if (!docId || !groupId) return null
    const doc = new Y.Doc()
    const provider = new SupabaseYProvider(docId, groupId, doc)
    return { doc, provider }
  }, [docId, groupId])

  useEffect(() => () => collab?.provider.destroy(), [collab])

  const editor = useCreateBlockNote({
    dictionary: lang === 'en' ? en : ko,
    ...(collab
      ? {
          collaboration: {
            provider: collab.provider,
            fragment: collab.doc.getXmlFragment('document-store'),
            user: { name: displayName, color: colorFor(displayName) },
          },
        }
      : { initialContent: parseContent(content) }),
  })

  // Seed a fresh shared doc from stored content exactly once.
  // ponytail: 500ms sync window guards against a late joiner re-seeding; simultaneous
  // first-openers is a rare race — acceptable for a hackathon, upgrade to server auth if it bites.
  useEffect(() => {
    if (!collab) {
      ready.current = true
      return
    }
    const meta = collab.doc.getMap('meta')
    const stored = parseContent(content)
    const t = setTimeout(() => {
      // meta.seeded lives in the CRDT, so a late joiner (backfilled) sees it and won't re-seed.
      if (!meta.get('seeded') && stored) {
        meta.set('seeded', true)
        editor.replaceBlocks(editor.document, stored)
      }
      // Only allow saves once seeding/backfill has settled — never persist the empty pre-seed doc.
      ready.current = true
    }, 500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collab, editor])

  return (
    <div className="blocknote-wrap">
      <BlockNoteView
        editor={editor}
        theme="dark"
        onChange={() => {
          if (!ready.current) return
          clearTimeout(timer.current)
          timer.current = setTimeout(() => onChange(JSON.stringify(editor.document)), 600)
        }}
      />
    </div>
  )
}
