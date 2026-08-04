import type { TranscriptEntry } from '../lib/caption'

// Overlay of the most recent captions, rendered in the viewer's language.
export function Captions({
  entries,
  displayLang,
}: {
  entries: TranscriptEntry[]
  displayLang: string
}) {
  const recent = entries.slice(-3)
  if (recent.length === 0) return null
  return (
    <div className="captions">
      {recent.map((e) => (
        <div key={e.id} className="glass caption">
          <b>
            {e.speaker}
            {e.kind === 'sign' ? ' ✋' : ''}
          </b>
          {e.translations[displayLang] || e.sourceText}
        </div>
      ))}
    </div>
  )
}
