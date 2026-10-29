/**
 * UX-01 — One native input dock for text, single-tap local STT,
 * owner-enabled open microphone and optional VI-01 local photo.
 * All paths submit through the existing App.respond and Ollama bridge.
 */
import { useRef, useState, type KeyboardEvent } from 'react'
import { prepareVisualImage, validateVisualFile, type LocalVisualImage } from '../lib/visual-input'
import type { LumiaInputMode } from '../lib/input-mode'

type Props = {
  available: boolean
  mode: LumiaInputMode
  recording: boolean
  busy: boolean
  visionAvailable: boolean
  onModeChange: (mode: LumiaInputMode) => void
  onSend: (text: string, image?: LocalVisualImage) => void
  onStartRecording: () => void
  onStopRecording: () => void
}

const modes: { value: LumiaInputMode; label: string; hint: string }[] = [
  { value: 'text', label: 'ESCRIBIR', hint: 'El micrófono permanece apagado' },
  { value: 'push', label: 'DICTAR', hint: 'Pulsa para grabar y pulsa para terminar' },
  { value: 'continuous', label: 'MIC ABIERTO', hint: 'Di «Lumi» para iniciar una conversación' },
]

export function LumiaComposer({
  available, mode, recording, busy, visionAvailable,
  onModeChange, onSend, onStartRecording, onStopRecording,
}: Props) {
  const [draft, setDraft] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [error, setError] = useState('')
  const photoInput = useRef<HTMLInputElement>(null)

  if (!available) return null

  const send = async () => {
    const text = draft.trim()
    if (!text && !photo) return
    if (preparing) return
    setPreparing(true)
    setError('')
    try {
      const image = photo ? await prepareVisualImage(photo) : undefined
      onSend(text || 'Describe esta imagen en español y señala lo que no se pueda comprobar.', image)
      setDraft('')
      setPhoto(null)
      if (photoInput.current) photoInput.current.value = ''
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar la imagen.')
    } finally {
      setPreparing(false)
    }
  }

  const handleKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return
    event.preventDefault()
    void send()
  }

  return (
    <section className="lumia-composer" aria-label="Conversación con LUMIA">
      <div className="lumia-composer-top">
        <span className="lumia-composer-name">L.U.M.I.A. · CONVERSACIÓN</span>
        <span className="lumia-composer-privacy">
          {recording ? '● GRABANDO LOCALMENTE'
            : mode === 'continuous' ? '● MICRÓFONO ABIERTO'
              : '○ MICRÓFONO EN REPOSO'}
        </span>
      </div>
      <div className="lumia-composer-modes" role="group" aria-label="Modo de entrada">
        {modes.map((item) => (
          <button
            key={item.value}
            type="button"
            className={mode === item.value ? 'lumia-composer-mode is-active' : 'lumia-composer-mode'}
            aria-pressed={mode === item.value}
            title={item.hint}
            disabled={busy || recording || preparing}
            onClick={() => { setError(''); onModeChange(item.value) }}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="lumia-composer-entry">
        <textarea
          aria-label="Escribe tu mensaje a LUMIA"
          placeholder="Escribe tu pregunta o instrucciones a Lumi…"
          rows={2}
          maxLength={6000}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKey}
        />
        <div className="lumia-composer-actions">
          <input
            ref={photoInput}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            className="lumia-composer-file-input"
            aria-label="Adjuntar fotografía para Qwen local"
            onChange={(event) => {
              const chosen = event.currentTarget.files?.[0] ?? null
              setError('')
              if (!chosen) { setPhoto(null); return }
              try {
                validateVisualFile(chosen)
                setPhoto(chosen)
              } catch (err) {
                setPhoto(null)
                setError(err instanceof Error ? err.message : 'Archivo no válido.')
              }
            }}
          />
          <button
            type="button"
            className="lumia-composer-action"
            disabled={!visionAvailable || preparing}
            onClick={() => photoInput.current?.click()}
            title={visionAvailable ? 'Adjuntar imagen JPG, PNG o WebP para Qwen local' : 'Visión local no disponible'}
          >
            + IMAGEN
          </button>
          {mode === 'push' && (
            <button
              type="button"
              className={recording ? 'lumia-composer-action is-recording' : 'lumia-composer-action'}
              aria-pressed={recording}
              disabled={busy || preparing}
              onClick={() => recording ? onStopRecording() : onStartRecording()}
            >
              {recording ? '■ TERMINAR AUDIO' : '● GRABAR AUDIO'}
            </button>
          )}
          <span className="lumia-composer-spacer" />
          <button
            type="button"
            className="lumia-composer-send"
            disabled={preparing || (!draft.trim() && !photo)}
            onClick={() => void send()}
          >
            {preparing ? 'PREPARANDO…' : 'ENVIAR ↗'}
          </button>
        </div>
      </div>
      {photo && (
        <div className="lumia-composer-attachment">
          <span>IMAGEN ADJUNTA · {photo.name}</span>
          <button type="button" aria-label="Quitar imagen" onClick={() => {
            setPhoto(null)
            if (photoInput.current) photoInput.current.value = ''
          }}>×</button>
        </div>
      )}
      <p className="lumia-composer-hint">
        {mode === 'text' ? 'Enter envía · Shift+Enter cambia de línea · Adjunta imágenes locales'
          : mode === 'push' ? (recording ? 'Habla naturalmente; pulsa TERMINAR para transcribir hasta 20 s.' : 'Graba solo al pulsar. Whisper transcribe localmente al terminar.')
            : 'Escucha continua activada por ti. Di «Lumi»; también puedes escribir o adjuntar una foto.'}
      </p>
      {error && <div className="lumia-composer-error" role="alert">{error}</div>}
    </section>
  )
}
