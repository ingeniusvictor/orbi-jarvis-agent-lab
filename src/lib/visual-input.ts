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

// AMR-02.3: explicit, session-only benchmark of the *same* photograph at
// different maximum long-side resolutions. The original 1024 preset remains
// the default; reducing image detail is never automatic or irreversible.
export const VISION_RESOLUTION_CHOICES = [512, 768, 1024] as const
export type VisionResolution = typeof VISION_RESOLUTION_CHOICES[number]
export const DEFAULT_VISION_RESOLUTION: VisionResolution = 1024

export function visionResolutionEdges(maxEdge: VisionResolution = DEFAULT_VISION_RESOLUTION): number[] {
  if (maxEdge === 512) return [512]
  if (maxEdge === 768) return [768, 640, 512]
  if (maxEdge === 1024) return [1024, 800, 640, 512]
  throw new Error('Resolución visual no admitida.')
}

function reportPreparedFrame(source: 'file'|'camera', limit: VisionResolution, width: number, height: number, chars: number):void {
  // Metadata only, never log image pixels, JPEG data, filenames or the prompt.
  console.info('[lumia:vision-amr023] prepared',
    `source=${source} limit=${limit}px actual=${width}x${height} encodedChars=${chars}`)
}
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
export async function prepareVisualImage(file: File, maxEdge:VisionResolution=DEFAULT_VISION_RESOLUTION): Promise<LocalVisualImage> {
  validateVisualFile(file)
  const bitmap = await createImageBitmap(file)
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 100_000_000) {
      throw new Error('Dimensiones de imagen no válidas.')
    }
    for (const edge of visionResolutionEdges(maxEdge)) {
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
        reportPreparedFrame('file', maxEdge, width, height, data.length)
        return { mimeType: 'image/jpeg', data }
      }
    }
    throw new Error('Esta imagen es demasiado grande incluso después de reducirla.')
  } finally {
    bitmap.close()
  }
}


/**
 * VISION-02: same size, encoding and payload limits as the approved photo
 * path, but reads one already-authorized video element in memory. The source
 * frame is NOT mirrored, so printed labels remain legible.
 */
export function prepareVisualCameraFrame(video:HTMLVideoElement,maxEdge:VisionResolution=DEFAULT_VISION_RESOLUTION):LocalVisualImage {
  if(!video.videoWidth || !video.videoHeight ||
      video.videoWidth*video.videoHeight>100_000_000){
    throw new Error('La cámara no entregó un fotograma válido.')
  }
  for (const edge of visionResolutionEdges(maxEdge)){
    const factor=Math.min(1,edge/Math.max(video.videoWidth,video.videoHeight))
    const width=Math.max(1,Math.round(video.videoWidth*factor))
    const height=Math.max(1,Math.round(video.videoHeight*factor))
    const canvas=document.createElement('canvas')
    canvas.width=width
    canvas.height=height
    const ctx=canvas.getContext('2d')
    if(!ctx)throw new Error('No se pudo preparar la captura de cámara.')
    ctx.drawImage(video,0,0,width,height)
    const url=canvas.toDataURL('image/jpeg',.76)
    const data=url.slice(url.indexOf(',')+1)
    if(data.length && data.length<=MAX_VISUAL_PAYLOAD_CHARS){
      reportPreparedFrame('camera',maxEdge,width,height,data.length)
      return {mimeType:'image/jpeg',data}
    }
  }
  throw new Error('La captura de cámara supera el límite permitido.')
}
