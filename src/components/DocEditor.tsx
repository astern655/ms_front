import { useRef } from 'react'
import type { PartialBlock } from '@blocknote/core'
import { ko, en } from '@blocknote/core/locales'
import { useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/mantine'
import '@blocknote/mantine/style.css'

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

// Notion-style block editor (headings, lists, checkboxes, tables, slash menu, …).
// Content is stored as BlockNote JSON in docs.content. Remount (via key) to switch docs.
export function DocEditor({
  content,
  onChange,
  lang = 'ko',
}: {
  content: string
  onChange: (json: string) => void
  lang?: string
}) {
  const editor = useCreateBlockNote({
    initialContent: parseContent(content),
    dictionary: lang === 'en' ? en : ko,
  })
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  return (
    <div className="blocknote-wrap">
      <BlockNoteView
        editor={editor}
        theme="dark"
        onChange={() => {
          clearTimeout(timer.current)
          timer.current = setTimeout(() => onChange(JSON.stringify(editor.document)), 600)
        }}
      />
    </div>
  )
}
