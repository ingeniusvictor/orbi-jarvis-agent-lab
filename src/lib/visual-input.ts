/**
 * VI-01: One opt-in still image per user request.
 * Photos are resized in the browser before they travel to the local bridge.
 * Never write the original file or base64 image into conversation state.
 */
export type LocalVisualImage = {
  mimeType: 'image/jpeg'
  data: string
}

export const MAX_VISUAL_FILE_BYTES = 12 * 1024 * 1024
export const MAX_VISUAL_PAYLOAD_CHARS = 2_000_000
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export function validateVisualFile(file: Pick<File, 'type' | 'size'>): void {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error('Selecciona una fotografía JPG, PNG o WebP.')
  }
  if (file.size <= 0 || file.size > MAX_VISUAL_FILE_BYTES) {
    throw new Error('La imagen debe ocupar entre 1 byte y 12 MB.')
  }
}

/** Encoding never opens a camera or reads the screen; it needs a file selected
 * by the owner via the standard browser file picker. */
export async function prepareVisualImage(file: File): Promise<LocalVisualImage> {
  validateVisualFile(file)
  const bitmap = await createImageBitmap(file)
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 100_000_000) {
      throw new Error('Dimensiones de imagen no válidas.')
    }
    for (const edge of [1024, 800, 640, 512]) {
      const factor = Math.min(1, edge / Math.max(bitmap.width, bitmap.height))
      const width = Math.max(1, Math.round(bitmap.width * factor))
      const height = Math.max(1, Math.round(bitmap.height * factor))
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('No se pudo preparar la imagen localmente.')
      ctx.drawImage(bitmap, 0, 0, width, height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.76)
      const data = dataUrl.slice(dataUrl.indexOf(',') + 1)
      if (data.length && data.length <= MAX_VISUAL_PAYLOAD_CHARS) {
        return { mimeType: 'image/jpeg', data }
      }
    }
    throw new Error('Esta imagen es demasiado grande incluso después de reducirla.')
  } finally {
    bitmap.close()
  }
}
