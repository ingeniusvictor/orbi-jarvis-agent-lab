/**
 * VI-01: local, user-initiated vision pilot. No webcam access, screenshot
 * capture, background polling or file persistence; does not modify the avatar.
 */
import { useRef, useState } from 'react'
import {
  prepareVisualImage,
  type LocalVisualImage,
} from '../lib/visual-input'

type Props = {
  available: boolean
  onAnalyze: (prompt: string, image: LocalVisualImage) => Promise<void>
}

export function VisualInput({ available, onAnalyze }: Props) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [prompt, setPrompt] = useState(
    'Describe qué ves en esta imagen en español. Señala lo que no puedas comprobar.',
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const picker = useRef<HTMLInputElement>(null)

  if (!available) return null

  const analyze = async () => {
    if (!file || busy) return
    setBusy(true)
    setError('')
    try {
      const image = await prepareVisualImage(file)
      await onAnalyze(prompt.trim() || 'Describe esta imagen.', image)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="lumia-visual-input" aria-label="Visión local experimental">
      <button
        className="lumia-visual-toggle"
        aria-expanded={open}
        aria-controls="lumia-visual-dialog"
        type="button"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? 'CERRAR VISIÓN' : 'VISIÓN · FOTO'}
      </button>
      {open && (
        <div id="lumia-visual-dialog" className="lumia-visual-dialog">
          <div className="lumia-visual-heading">ANALIZAR IMAGEN LOCAL</div>
          <div className="lumia-visual-help">
            Solo se envía al Ollama local la imagen que selecciones.
            Se reduce a JPEG antes del envío. No activa cámara.
          </div>
          <input
            ref={picker}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            aria-label="Selecciona una fotografía"
            onChange={(event) => {
              setFile(event.currentTarget.files?.[0] ?? null)
              setError('')
            }}
          />
          {file && <div className="lumia-visual-filename">{file.name}</div>}
          <label className="lumia-visual-label" htmlFor="lumia-visual-prompt">
            ¿QUÉ DEBE EXAMINAR LUMIA?
          </label>
          <textarea
            id="lumia-visual-prompt"
            value={prompt}
            rows={3}
            maxLength={900}
            onChange={(event) => setPrompt(event.target.value)}
          />
          <button
            className="lumia-visual-submit"
            type="button"
            disabled={!file || busy}
            onClick={() => void analyze()}
          >
            {busy ? 'ANALIZANDO…' : 'ANALIZAR Y RESPONDER'}
          </button>
          {error && <div className="lumia-visual-error" role="alert">{error}</div>}
        </div>
      )}
    </section>
  )
}
