/**
 * AMR-02.6: metadata validation and a MINIMAL in-memory discrepancy guard.
 * No JPEG, file path, image fingerprint, user prompt, transcript or OCR string
 * is written into the ledger. This is not a detector and does not certify truth.
 */
const TTL_MS=5*60_000
const MAX_FRAMES=16
const numWords={dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10,once:11,doce:12,trece:13,catorce:14,quince:15,dieciseis:16,diecisiete:17,dieciocho:18,diecinueve:19,veinte:20}
const numberPattern='(?:[2-9]|1[0-9]|20|'+Object.keys(numWords).join('|')+')'
const groupPattern=new RegExp('\\b(?:veo|hay|se ven|aparecen|observo|cuento|distingo|grupo de|un total de|total de|son)\\s+(?:(?:un|una)\\s+grupo\\s+de\\s+)?(?:alrededor de |aproximadamente )?('+numberPattern+')\\s+(?:personas|hombres|mujeres|figuras|ninos|ninas|individuos)\\b','u')
const normalize=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim()

export function safeVisionTrace(raw,encodedLength){
  if(!raw || typeof raw!=='object' || Array.isArray(raw))return null
  const {photoId,turnId,source,role,intent,limitPx,width,height,encodedChars}=raw
  if(typeof photoId!=='string'||!/^p[a-zA-Z0-9-]{8,60}$/.test(photoId))return null
  if(typeof turnId!=='string'||!/^[a-zA-Z0-9-]{8,70}$/.test(turnId))return null
  if(source!=='file' && source!=='camera')return null
  if(role!=='new'&&role!=='followup'&&role!=='reanalysis')return null
  if(intent!=='count'&&intent!=='ocr'&&intent!=='scene')return null
  if(![512,768,1024].includes(limitPx))return null
  if(!Number.isInteger(width)||!Number.isInteger(height)||
    width<1||height<1||width>limitPx||height>limitPx)return null
  if(!Number.isInteger(encodedChars)||encodedChars<4||encodedChars>2_000_000||encodedChars!==encodedLength)return null
  return {photoId,turnId,source,role,intent,limitPx,width,height,encodedChars}
}

export function explicitGroupCount(answer){
  const text=normalize(answer)
  // A subgroup ('seis personas de pie') cannot replace the overall group
  // total ('siete personas'); keep looking for an explicit overall count.
  const groupMatches=new RegExp(groupPattern.source,'gu')
  for(const m of text.matchAll(groupMatches)){
    const remainder=text.slice((m.index??0)+m[0].length)
    if(/^\s+(?:de pie|sentad[oa]s?|agachad[oa]s?|parad[oa]s?|al fondo|al frente|en primer plano)\b/.test(remainder))continue
    const count=Number(m[1])||numWords[m[1]]
    if(Number.isInteger(count)&&count>=2&&count<=20)return count
  }
  return null
}

export const countQuestion=q=>/\b(?:cuantos|cuantas|cuenta|contar|conteo|numero de personas|total de personas|cuantos hombres|cuantas mujeres)\b/.test(normalize(q))

const COUNT_CONFLICT_SPEECH =
  'He dado conteos diferentes al analizar esta misma fotografía. ' +
  'No puedo confirmar la cantidad exacta con seguridad. ' +
  'Si deseas comprobarla, puedes pedir un reanálisis de mayor detalle o proporcionar otra imagen.'

export function createVisionCountLedger(){
  // Per-WebSocket, bounded/ephemeral data. The *first observation* is an
  // immutable comparison anchor, NOT verified ground truth. Once a mismatch
  // occurs, a later repetition cannot erase it (ASUS 8 -> 7 -> 7 -> 7).
  // Only numeric counts, UUID-like photoId and timestamps are retained.
  const entries=new Map()
  return {
    review({photoId,answer,intent,now=Date.now()}){
      for(const [k,v] of entries)if(now-v.at>=TTL_MS)entries.delete(k)
      const count=explicitGroupCount(answer)
      if(!photoId)return {text:answer,status:'unmeasured',count:null}
      const old=entries.get(photoId)
      if(count===null){
        // Do not override a naturally uncertain answer with an unsupported
        // count. Keep the discrepancy latched until session expiry/clear.
        return {text:answer,status:old?.conflicted?'conflict-held-no-count':'unmeasured',count:null}
      }
      if(!old){
        entries.set(photoId,{firstCount:count,lastCount:count,conflicted:false,at:now})
        if(entries.size>MAX_FRAMES)entries.delete(entries.keys().next().value)
        return {text:answer,status:'first',count}
      }
      // Bounded LRU and inactivity TTL, never reset the initial observation.
      entries.delete(photoId)
      const becameConflicted=!old.conflicted && count!==old.firstCount
      const conflicted=old.conflicted || count!==old.firstCount
      entries.set(photoId,{
        firstCount:old.firstCount,lastCount:count,conflicted,at:now
      })
      if(conflicted)return {
        text:COUNT_CONFLICT_SPEECH,
        status:becameConflicted?'count-discrepancy':'conflict-persisted',
        count,previous:old.firstCount
      }
      return {text:answer,status:'consistent',count}
    },
    clear(){entries.clear()},
    get size(){return entries.size}
  }
}
