export type TranscriptEntry = {
  id: string
  speaker: string
  kind: 'speech' | 'sign'
  sourceLang: string
  sourceText: string
  translations: Record<string, string>
  ts: number
}

export function encodeCaption(e: TranscriptEntry): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(e))
}

export function decodeCaption(d: Uint8Array): TranscriptEntry {
  return JSON.parse(new TextDecoder().decode(d)) as TranscriptEntry
}
