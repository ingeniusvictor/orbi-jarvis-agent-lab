/**
 * PH-04.5 — owner-triggered guided Motion R8 tour. One authorized App turn,
 * one existing speaker, one VRM Canvas. Animations are cued ONLY by a phrase
 * actually beginning audible playback, not by model tokens or wall-clock timers.
 *
 * No imported FBX/VRM binaries, secondary TTS or cloud requests.
 */
import { motionCatalog } from './motion-library-catalog.js'
import {
  avatarPresenceSnapshot, requestLumiaAvatarMotion, resumeLumiaAvatarMotion,
  setLumiaAvatarView, type LumiaAvatarView,
} from './avatar-presence-ph04'

export type GuidedDemoStep = {
  type: 'intro' | 'motion' | 'face' | 'transition' | 'outro'
  speech: string
  motionId?: string
  expression?: 'joy' | 'sorrow' | 'angry' | 'fun' | 'neutral'
  view?: LumiaAvatarView
}
const descriptions: Record<string, string> = {
  waving: 'Mira cómo saludo con la mano.',
  talking: 'Así acompaño mis palabras con movimientos corporales.',
  idle: 'Esta es mi postura de reposo natural.',
  listening: 'También puedo hacer un gesto de escucha.',
  nails: 'Ahora observo mis propias manos.',
  thinking: 'Esta es mi postura cuando pienso.',
  pointing: 'Mira cómo señalo un punto.',
  pointinggesture: 'Y puedo señalar con un gesto más amplio.',
  no: 'Con este gesto digo que no.',
  happy: 'Este movimiento expresa alegría.',
  excited: 'Y este otro muestra entusiasmo.',
  surprised: 'También puedo expresar sorpresa.',
  clapping: 'Ahora voy a aplaudir.',
  kiss: 'Puedo enviarte un beso con un gesto.',
  walking: 'También puedo caminar en el mismo lugar.',
  walkingforward: 'Mira cómo doy pasos hacia adelante.',
  walkingcircle: 'Y puedo realizar un paseo circular.',
}
if (Object.keys(descriptions).length !== 17 ||
    motionCatalog.some((item) => !descriptions[item.id])) {
  throw new Error('PH-04.5: el catálogo de 17 animaciones cambió; revisar el recorrido.')
}
export const LUMIA_GUIDED_DEMO_STEPS: ReadonlyArray<GuidedDemoStep> = [
  { type: 'intro', speech: 'Voy a enseñarte mis diecisiete movimientos corporales y después algunas expresiones faciales. Empecemos.', view: 'body-vrm' },
  ...motionCatalog.map((item) => ({
    type: 'motion' as const,
    speech: descriptions[item.id],
    motionId: item.id,
    view: 'body-vrm' as const,
  })),
  { type: 'transition', speech: 'Ahora acercaré mi rostro para mostrar cómo cambia mi expresión.', view: 'head-vrm' },
  { type: 'face', speech: 'Esta es mi expresión facial de alegría.', expression: 'joy', view: 'head-vrm' },
  { type: 'face', speech: 'También puedo expresar tristeza.', expression: 'sorrow', view: 'head-vrm' },
  { type: 'face', speech: 'Esta es mi expresión de enojo.', expression: 'angry', view: 'head-vrm' },
  { type: 'face', speech: 'Y esta es una expresión de diversión.', expression: 'fun', view: 'head-vrm' },
  { type: 'face', speech: 'Finalmente, regreso a mi rostro neutral.', expression: 'neutral', view: 'head-vrm' },
  { type: 'outro', speech: 'Esta fue mi demostración virtual. Puedes pedirme un gesto específico o cambiar de vista cuando quieras.', view: 'head-vrm' },
]

export type GuidedDemoSnapshot = {
  active: boolean
  completed: number
  total: number
  current: string
  expression: GuidedDemoStep['expression'] | null
}
const listeners = new Set<() => void>()
const notify = () => { for (const listener of listeners) listener() }
let active: {turnId:string;previous:LumiaAvatarView;step:number;expression:GuidedDemoStep['expression']|null} | null = null

const normalize = (text:string) => String(text).normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ')

export function guidedDemoScript():string {
  return LUMIA_GUIDED_DEMO_STEPS.map((step) => step.speech).join(' ')
}
export function guidedDemoSnapshot():GuidedDemoSnapshot {
  return {
    active: Boolean(active),
    completed: active ? active.step + 1 : 0,
    total: LUMIA_GUIDED_DEMO_STEPS.length,
    current: active && active.step >= 0
      ? LUMIA_GUIDED_DEMO_STEPS[active.step]?.speech ?? ''
      : '',
    expression: active?.expression ?? null,
  }
}
export function subscribeGuidedDemo(listener:()=>void):()=>void {
  listeners.add(listener)
  return ()=>{listeners.delete(listener)}
}
export function currentGuidedFaceExpression():GuidedDemoStep['expression'] | null {
  return active?.expression ?? null
}
export function beginGuidedDemo(turnId:string):void {
  if (active) endGuidedDemo(active.turnId)
  active={turnId,previous:avatarPresenceSnapshot().view,step:-1,expression:null}
  setLumiaAvatarView('body-vrm')
  notify()
}
export function cueGuidedDemoPhrase(turnId:string,playedText:string):void {
  if (!active || active.turnId!==turnId) return
  const spoken=normalize(playedText)
  const next=LUMIA_GUIDED_DEMO_STEPS.findIndex((step,i)=>
    i>active!.step && normalize(step.speech)===spoken)
  if (next<0)return // Do not animate from partial, synthetic or unplayed speech.
  active.step=next
  const step=LUMIA_GUIDED_DEMO_STEPS[next]
  if(step.view && avatarPresenceSnapshot().view!==step.view) setLumiaAvatarView(step.view)
  active.expression=step.expression??null
  if(step.motionId)requestLumiaAvatarMotion(step.motionId)
  if(step.type==='transition'||step.type==='face'||step.type==='outro')resumeLumiaAvatarMotion()
  notify()
}
export function endGuidedDemo(turnId:string):void {
  if(!active || active.turnId!==turnId)return
  const previous=active.previous
  active=null
  resumeLumiaAvatarMotion()
  setLumiaAvatarView(previous)
  notify()
}
export function cancelGuidedDemo():void {
  if(active)endGuidedDemo(active.turnId)
}
/** Preflight: fail closed if the owner's 17 private files are absent. */
export async function checkGuidedDemoAssets(
  fetcher: typeof fetch = fetch,
):Promise<{available:boolean;missing:string[]}> {
  const result=await Promise.all(motionCatalog.map(async (item)=>{
    try{
      const response=await fetcher(item.path,{method:'HEAD',cache:'no-store'})
      const type=response.headers.get('content-type')?.toLowerCase()??''
      return response.ok && !type.includes('text/html') ? null : item.file
    }catch{return item.file}
  }))
  const missing=result.filter((name):name is string=>Boolean(name))
  return {available:missing.length===0,missing}
}
