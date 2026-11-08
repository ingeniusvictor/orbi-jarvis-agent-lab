/**
 * AMR-03.0: narrow arithmetic self-check of a SINGLE visual answer.
 * It does not inspect images, infer any true count, or make another AI call.
 * Only replaces a locally contradictory total when two explicitly stated,
 * disjoint posture categories add to MORE than the stated total.
 */
const numerals={
  un:1,uno:1,una:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,
  ocho:8,nueve:9,diez:10,once:11,doce:12,trece:13,catorce:14,
  quince:15,dieciseis:16,diecisiete:17,dieciocho:18,diecinueve:19,veinte:20,
}
const n='(?:\\d{1,2}|'+Object.keys(numerals).join('|')+')'
const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  .replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim()
const toNum=s=>Number(s)||numerals[s]||null
const totalRe=new RegExp('\\b('+n+')\\s+(?:personas|figuras(?:\\s+humanas)?)\\b','g')
const categoryRe=new RegExp('\\b('+n+')\\s+(?:(?:de\\s+(?:ellos|ellas)\\s+)?(?:se\\s+encuentran\\s+|estan\\s+|estan\\s+todos\\s+)?)(de\\s+pie|parados?|paradas?|sentados?|sentadas?|agachados?|agachadas?)\\b','g')
const postureType=value=>/pie|parad/.test(value)?'standing':/sentad/.test(value)?'sitting':'crouching'
const CHECK_TEXT='Al revisar mi descripción, detecté que el total y las posturas que mencioné no coinciden. No puedo confirmar la cantidad exacta con seguridad. Si quieres, puedo contar de nuevo la fotografía con más detalle.'

export function guardVisualPostureCount(answer){
  const original=String(answer??'')
  const s=norm(original)
  let total=null
  for(const m of s.matchAll(totalRe)){
    const rest=s.slice((m.index??0)+m[0].length)
    // A subgroup such as "siete personas de pie" is NOT the total.
    if(/^(?:\s+)(?:de pie|sentadas?|sentados?|agachadas?|agachados?|paradas?|parados?)\b/.test(rest))continue
    const number=toNum(m[1])
    if(number!==null&&number>0&&number<=30){total=number;break}
  }
  if(total===null)return {text:original,status:'no-total'}
  const groups=new Map()
  for(const m of s.matchAll(categoryRe)){
    const count=toNum(m[1])
    if(count===null||count<1||count>30)continue
    const type=postureType(m[2])
    // If a model supplies conflicting counts for the *same* posture category,
    // do not guess which is intended; defer to existing cross-turn safeguards.
    if(groups.has(type)&&groups.get(type)!==count) return {text:original,status:'ambiguous-subgroups'}
    groups.set(type,count)
  }
  if(groups.size<2)return {text:original,status:'not-enough-categories'}
  const sum=[...groups.values()].reduce((a,b)=>a+b,0)
  if(sum<=total)return {text:original,status:'no-proven-overflow'}
  return {text:CHECK_TEXT,status:'posture-total-overflow',claimedTotal:total,claimedPostures:sum}
}
