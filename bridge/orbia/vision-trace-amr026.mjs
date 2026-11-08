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
  .toLowerCase().replace(/[^\\p{L}\\p{N}]+/gu,' ').replace(/\\s+/g,' ').trim()

export function safeVisionTrace(raw,encodedLength){
  if(!raw || typeof raw!=='object' || Array.isArray(raw))return null
  const {photoId,turnId,source,role,limitPx,width,height,encodedChars}=raw
  if(typeof photoId!=='string'||!/^p[a-zA-Z0-9-]{8,60}$/.test(photoId))return null
  if(typeof turnId!=='string'||!/^[a-zA-Z0-9-]{8,70}$/.test(turnId))return null
  if(source!=='file' && source!=='camera')return null
  if(role!=='new'&&role!=='followup'&&role!=='reanalysis')return null
  if(![512,768,1024].includes(limitPx))return null
  if(!Number.isInteger(width)||!Number.isInteger(height)||
    width<1||height<1||width>limitPx||height>limitPx)return null
  if(!Number.isInteger(encodedChars)||encodedChars<4||encodedChars>2_000_000||encodedChars!==encodedLength)return null
  return {photoId,turnId,source,role,limitPx,width,height,encodedChars}
}

export function explicitGroupCount(answer){
  const m=groupPattern.exec(normalize(answer))
  if(!m)return null
  const count=Number(m[1])||numWords[m[1]]
  return Number.isInteger(count)&&count>=2&&count<=20?count:null
}

export const countQuestion=q=>/\\b(?:cuantos|cuantas|cuenta|contar|conteo|numero de personas|total de personas|cuantos hombres|cuantas mujeres)\\b/.test(normalize(q))

export function createVisionCountLedger(){
  // Ephemeral, per-WebSocket, bounded to only recent explicit group counts.
  const entries=new Map()
  return {
    review({photoId,answer,question,now=Date.now()}){
      for(const [k,v] of entries)if(now-v.at>=TTL_MS)entries.delete(k)
      const count=explicitGroupCount(answer)
      if(!photoId || count===null)return {text:answer,status:'unmeasured',count:null}
      const old=entries.get(photoId)
      entries.delete(photoId)
      entries.set(photoId,{count,at:now})
      if(entries.size>MAX_FRAMES)entries.delete(entries.keys().next().value)
      if(!old)return {text:answer,status:'first',count}
      if(old.count===count)return {text:answer,status:'consistent',count}
      if(!countQuestion(question))return {text:answer,status:'changed-observation',count,previous:old.count}
      return {
        text:'Al revisar la misma fotografía, obtuve conteos diferentes y no puedo asegurar la cifra exacta. Para verificarlo, necesitaría una imagen más clara o un análisis a mayor detalle.',
        status:'count-discrepancy',count,previous:old.count
      }
    },
    clear(){entries.clear()},
    get size(){return entries.size}
  }
}
