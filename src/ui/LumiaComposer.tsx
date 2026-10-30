/**
 * UX-02 — LUMIA premium glass dock.
 *
 * A single lightweight bar, inspired by compact messaging composers.
 * Native text is always present. Icon buttons expose only features that are
 * actually connected: owner-selected photos (VI-01), tap-to-dictate (Whisper),
 * and explicitly enabled continuous listening. No new permissions or tools.
 */
import { useRef, useState, type KeyboardEvent } from 'react'
import {
  prepareVisualImage, validateVisualFile,
  type LocalVisualImage,
} from '../lib/visual-input'
import type { LumiaInputMode } from '../lib/input-mode'
import { TRANSLATION_CHOICES, validateTranslationAudioFile, type TranslationLanguage } from '../lib/translate'

type Props = {
  available: boolean
  mode: LumiaInputMode
  recording: boolean
  busy: boolean
  visionAvailable: boolean
  translationAvailable: boolean
  onTranslate: (text: string, source: TranslationLanguage, target: TranslationLanguage) => void
  onTranslateAudio: (file: File, source: TranslationLanguage, target: TranslationLanguage) => Promise<void>
  onModeChange: (mode: LumiaInputMode) => void
  onSend: (text: string, image?: LocalVisualImage) => void
  onStartRecording: () => void
  onStopRecording: () => void
  onCancelRecording: () => void
}

type IconName = 'image' | 'audio' | 'mic' | 'wave' | 'send' | 'stop' | 'close' | 'cancel' | 'translate'
function DockIcon({ name }: { name: IconName }) {
  const common = {
    width: 20, height: 20, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor', strokeWidth: 1.7,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
    'aria-hidden': true as const, focusable: false as const,
  }
  if (name === 'translate') return (
    <svg {...common}>
      <path d="M3 6h12M9 3v3M5 10c2 3 5 5 9 6M13 10c-2 4-5 7-9 8" />
      <path d="M15 21l3-8 3 8M16.1 18h3.8" />
    </svg>
  )
  if (name === 'audio') return (
    <svg {...common}><path d="M3 12v3m4-8v10m4-15v20m4-15v10m4-8v8m4-6v4" /></svg>
  )
  if (name === 'image') return (
    <svg {...common}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8.4" cy="8.6" r="1.3" />
      <path d="m3.8 17.5 5.3-5.4 3.4 3.5 2.9-3.1 4.8 5.5" />
    </svg>
  )
  if (name === 'mic') return (
    <svg {...common}>
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v4m-4 0h8" />
    </svg>
  )
  if (name === 'wave') return (
    <svg {...common}>
      <path d="M2 10v4m4-7v10m4-14v18m4-12v6m4-10v14m4-9v4" />
    </svg>
  )
  if (name === 'send') return (
    <svg {...common} fill="currentColor" stroke="none">
      <path d="M21.4 2.7a.9.9 0 0 0-.95-.16L2.7 10.1a1 1 0 0 0 .08 1.87l7.15 2.24 2.24 7.15a1 1 0 0 0 1.87.08l7.52-17.76a.9.9 0 0 0-.16-.98ZM11.3 12.7 6 11l11.2-5.1-5.9 6.8Z" />
    </svg>
  )
  if (name === 'stop') return (
    <svg {...common} fill="currentColor" stroke="none">
      <rect x="7" y="7" width="10" height="10" rx="1.5" />
    </svg>
  )
  if (name === 'cancel') return (
    <svg {...common}><path d="M5 5l14 14M19 5 5 19" /></svg>
  )
  return (
    <svg {...common}><path d="M6 6l12 12M18 6 6 18" /></svg>
  )
}

export function LumiaComposer({
  available, mode, recording, busy, visionAvailable, translationAvailable, onTranslate, onTranslateAudio,
  onModeChange, onSend, onStartRecording, onStopRecording, onCancelRecording,
}: Props) {
  const [draft, setDraft] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [error, setError] = useState('')
  const [translateEnabled, setTranslateEnabled] = useState(false)
  const [sourceLanguage, setSourceLanguage] = useState<TranslationLanguage>('zh')
  const [targetLanguage, setTargetLanguage] = useState<TranslationLanguage>('es')
  const photoInput = useRef<HTMLInputElement>(null)
  const audioInput = useRef<HTMLInputElement>(null)
  const textarea = useRef<HTMLTextAreaElement>(null)
  if (!available) return null

  const adjustHeight = () => {
    const el = textarea.current
    if (!el) return
    el.style.height = '26px'
    el.style.height = Math.min(116, Math.max(26, el.scrollHeight)) + 'px'
  }
  const send = async () => {
    const text = draft.trim()
    if ((!text && !photo && !audioFile) || preparing || busy || recording) return
    if (translateEnabled && (photo || sourceLanguage === targetLanguage || (audioFile && text))) {
      setError('Selecciona idiomas diferentes y envía el audio separado del texto.'); return
    }
    setPreparing(true)
    setError('')
    try {
      const image = photo ? await prepareVisualImage(photo) : undefined
      if (translateEnabled && audioFile) await onTranslateAudio(audioFile, sourceLanguage, targetLanguage)
      else if (translateEnabled) onTranslate(text, sourceLanguage, targetLanguage)
      else onSend(text || 'Describe esta imagen en español y señala lo que no se pueda comprobar.', image)
      setDraft('')
      setPhoto(null)
      setAudioFile(null)
      if (photoInput.current) photoInput.current.value = ''
      if (audioInput.current) audioInput.current.value = ''
      if (textarea.current) textarea.current.style.height = '26px'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo procesar el mensaje.')
    } finally {
      setPreparing(false)
    }
  }
  const handleKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    void send()
  }
  const toggleDictation = () => {
    if (recording) {
      onStopRecording()
      return
    }
    if (mode !== 'push') onModeChange('push')
    onStartRecording()
  }
  const toggleContinuous = () => {
    onModeChange(mode === 'continuous' ? 'text' : 'continuous')
  }

  return (
    <section className="lumia-composer" aria-label="Conversación con LUMIA">
      <div className="lumia-composer-dock" data-mode={mode} data-recording={recording}>
        <input
          ref={photoInput}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          className="lumia-composer-file-input"
          aria-label="Seleccionar una fotografía para Qwen local"
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
              event.currentTarget.value = ''
            }
          }}
        />
        <button
          type="button"
          className={'lumia-composer-icon-button lumia-composer-attach' + (photo ? ' is-attached' : '')}
          aria-label={photo ? 'Cambiar fotografía adjunta' : 'Adjuntar imagen para LUMIA'}
          title={visionAvailable ? 'Adjuntar foto JPG, PNG o WebP · análisis local' : 'Visión local no disponible'}
          disabled={!visionAvailable || preparing || recording || translateEnabled}
          onClick={() => photoInput.current?.click()}
        ><DockIcon name="image" /></button>

        <textarea
          ref={textarea}
          className="lumia-composer-text"
          aria-label="Escribe tu mensaje a LUMIA"
          placeholder={translateEnabled ? 'Escribe el texto que deseas traducir…' : 'Pregunta algo a Lumi…'}
          rows={1}
          maxLength={6000}
          value={draft}
          onChange={(event) => { setDraft(event.target.value); adjustHeight() }}
          onKeyDown={handleKey}
          onFocus={() => { if (mode === 'continuous') onModeChange('text') }}
        />

        {recording && (
          <button
            type="button"
            className="lumia-composer-icon-button lumia-composer-cancel"
            aria-label="Cancelar dictado sin enviar"
            title="Cancelar dictado"
            onClick={onCancelRecording}
          ><DockIcon name="cancel" /></button>
        )}

        <button
          type="button"
          className={'lumia-composer-icon-button lumia-composer-dictate' + (recording ? ' is-recording' : '')}
          aria-label={recording ? 'Detener y transcribir dictado' : 'Dictar mensaje por micrófono'}
          aria-pressed={recording}
          title={recording ? 'Detener grabación y transcribir' : 'Dictar una vez · pulsa para comenzar y terminar'}
          disabled={busy || preparing || translateEnabled}
          onClick={toggleDictation}
        ><DockIcon name={recording ? 'stop' : 'mic'} /></button>

        <button
          type="button"
          className={'lumia-composer-icon-button lumia-composer-continuous' + (mode === 'continuous' ? ' is-active' : '')}
          aria-label={mode === 'continuous' ? 'Desactivar micrófono abierto' : 'Activar micrófono abierto'}
          aria-pressed={mode === 'continuous'}
          title={mode === 'continuous' ? 'Desactivar escucha continua' : 'Escucha continua · di Lumi para hablar'}
          disabled={busy || recording || preparing || translateEnabled}
          onClick={toggleContinuous}
        ><DockIcon name="wave" /></button>

        <button
          type="button"
          className={'lumia-composer-icon-button lumia-composer-translate' + (translateEnabled ? ' is-active' : '')}
          aria-label={translateEnabled ? 'Desactivar LUMIA Translate' : 'Activar LUMIA Translate'}
          aria-pressed={translateEnabled}
          title={translateEnabled ? 'Volver al chat normal en español' : 'Activar traducción local por texto'}
          disabled={!translationAvailable || recording || busy || preparing}
          onClick={() => {
            setError('')
            if (!translateEnabled) {
              if (mode !== 'text') onModeChange('text')
              setPhoto(null)
              if (photoInput.current) photoInput.current.value = ''
            }
            setTranslateEnabled(!translateEnabled)
          }}
        ><DockIcon name="translate" /></button>

        <button
          type="button"
          className="lumia-composer-send"
          aria-label="Enviar mensaje"
          title="Enviar · Enter"
          disabled={preparing || busy || recording || (!draft.trim() && !photo) ||
            (translateEnabled && (!draft.trim() || sourceLanguage === targetLanguage))}
          onClick={() => void send()}
        ><DockIcon name="send" /></button>
      </div>

      {translateEnabled && (
        <div className="lumia-translator-options" role="group" aria-label="Idiomas de LUMIA Translate">
          <span className="lumia-translator-title">TRADUCCIÓN LOCAL · TEXTO</span>
          <select aria-label="Idioma de origen" value={sourceLanguage}
            onChange={(event) => setSourceLanguage(event.target.value as TranslationLanguage)}>
            {TRANSLATION_CHOICES.map((language) => (
              <option key={language.value} value={language.value}>{language.label}</option>
            ))}
          </select>
          <button type="button" className="lumia-translator-swap" aria-label="Intercambiar idiomas"
            title="Intercambiar idiomas"
            onClick={() => { setSourceLanguage(targetLanguage); setTargetLanguage(sourceLanguage) }}>⇄</button>
          <select aria-label="Idioma de destino" value={targetLanguage}
            onChange={(event) => setTargetLanguage(event.target.value as TranslationLanguage)}>
            {TRANSLATION_CHOICES.map((language) => (
              <option key={language.value} value={language.value}>{language.label}</option>
            ))}
          </select>
        </div>
      )}
      {(photo || error || recording || busy) && (
        <div className="lumia-composer-feedback" aria-live="polite">
          {photo && (
            <span className="lumia-composer-photo">
              <DockIcon name="image" />
              <span title={photo.name}>{photo.name}</span>
              <button type="button" aria-label="Quitar fotografía adjunta" onClick={() => {
                setPhoto(null)
                if (photoInput.current) photoInput.current.value = ''
              }}><DockIcon name="close" /></button>
            </span>
          )}
          {recording && <span className="lumia-composer-mic-state">● GRABANDO · pulsa detener</span>}
          {!recording && busy && <span className="lumia-composer-mic-state">TRANSCRIBIENDO LOCALMENTE…</span>}
          {error && <span className="lumia-composer-error" role="alert">{error}</span>}
        </div>
      )}
    </section>
  )
}
