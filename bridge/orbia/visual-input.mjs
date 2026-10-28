/**
 * VI-01: validate the single owner-selected photo before it reaches Ollama.
 * Do not persist bytes in conversation history, disk, diagnostics or logs.
 */
const MAX_ENCODED_CHARS = 2_000_000
const MAX_DECODED_BYTES = 1_500_000

export function parseLocalVisualImage(value) {
  if (value === undefined || value === null) return null
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Formato de imagen local no válido.')
  }
  if (value.mimeType !== 'image/jpeg' || typeof value.data !== 'string') {
    throw new Error('Solo se admite una imagen JPEG procesada localmente.')
  }
  const data = value.data
  if (!data || data.length > MAX_ENCODED_CHARS ||
      data.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
    throw new Error('Tamaño o codificación de imagen inválidos.')
  }
  const bytes = Buffer.from(data, 'base64')
  // The JPEG SOI marker also rejects made-up base64-only data.
  if (bytes.length < 4 || bytes.length > MAX_DECODED_BYTES ||
      bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    throw new Error('La imagen no es un JPEG válido o supera 1,5 MB.')
  }
  return { mimeType: 'image/jpeg', data }
}
