import { useState } from 'react'
import { useStore } from '../store'
import { translateLocalText } from '../lib/translate'
import { formatAudioTranslationReview, parseAudioTranslationReview } from '../lib/audio-translation-review'

/** Owner-only LT-05B inline correction; no file upload, no second Whisper pass. */
export function AudioTranslationReview({turnId,text}: {turnId:string;text:string}) {
  const data=parseAudioTranslationReview(text)
  const [editing,setEditing]=useState(false)
  const [draft,setDraft]=useState('')
  const [busy,setBusy]=useState(false)
  const [failure,setFailure]=useState('')
  if (!data?.translation) return null

  const open=()=>{
    setDraft(data.correctedTranscript??data.rawTranscript)
    setFailure('')
    setEditing(true)
  }
  const cancel=()=>{ if (!busy) {setEditing(false);setFailure('')} }
  const retry=async()=>{
    if(busy) return
    const corrected=draft.trim()
    if(!corrected || corrected.length>4000) {
      setFailure('Introduce entre 1 y 4000 caracteres.')
      return
    }
    if (corrected===data.correctedTranscript || (!data.correctedTranscript && corrected===data.rawTranscript)) {
      setFailure('Corrige primero las palabras que Whisper reconoció mal.')
      return
    }
    setFailure('')
    setBusy(true)
    try {
      const translation=await translateLocalText(corrected,data.source,data.target)
      const current=useStore.getState().turns.find(turn=>turn.id===turnId)
      // Prevent a stale request from overwriting a replaced/completed turn.
      if (!current || current.text!==text) {
        setFailure('Esta respuesta cambió. Abre nuevamente la edición.')
        return
      }
      useStore.getState().updateTurn(turnId,{
        text:formatAudioTranslationReview(data,corrected,translation),
        status:'complete',errorNote:undefined,finishedAt:Date.now(),
      })
      setEditing(false)
    }catch(err){
      setFailure(err instanceof Error?err.message:'No se pudo volver a traducir.')
    }finally{
      setBusy(false)
    }
  }

  return (
    <div className="lumia-audio-review" aria-label="Revisión de traducción de audio">
      {!editing
        ? <button type="button" className="lumia-audio-review-action"
            aria-label="Editar la transcripción y retraducir sin repetir el audio"
            title="Editar el texto reconocido y retraducir; conserva la transcripción original"
            onClick={open}>
            <span aria-hidden="true">✎</span> Corregir y retraducir
          </button>
        : <div className="lumia-audio-review-editor">
            <label htmlFor={'lumia-review-'+turnId}>Corregir texto reconocido · no modifica el audio original</label>
            <textarea id={'lumia-review-'+turnId} rows={3} maxLength={4000}
              value={draft} disabled={busy}
              onChange={event=>setDraft(event.target.value)}
              aria-label="Transcripción corregida"/>
            <div className="lumia-audio-review-actions">
              <button type="button" onClick={()=>{void retry()}}
                disabled={busy || !draft.trim()} aria-label="Retraducir texto corregido">
                {busy?'Traduciendo…':'↻ Retraducir'}
              </button>
              <button type="button" onClick={cancel} disabled={busy}>Cancelar</button>
            </div>
            {failure && <p className="lumia-audio-review-error" role="alert">{failure}</p>}
          </div>}
    </div>
  )
}
