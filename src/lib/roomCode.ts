// Room code = the LiveKit room name. No server-side registry: the code IS the room id.
// Alphabet excludes ambiguous glyphs (0/O/1/I/L) so codes are easy to read and share aloud.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function generateRoomCode(length = 6): string {
  const buf = new Uint32Array(length)
  crypto.getRandomValues(buf)
  let code = ''
  for (let i = 0; i < length; i++) code += ALPHABET[buf[i] % ALPHABET.length]
  return code
}

// Accept messy user input ("abc-123 ", "a b c") and reduce to the canonical code.
export function normalizeRoomCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '')
}
