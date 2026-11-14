/**
 * VQ-05: grounded facial reactions to LUMIA's OWN audible TTS phrases.
 * Classifier is deliberately conservative: explicit, literal language only.
 * No emotion inference from the human speaker, camera, or microphone.
 *
 * This is an additive VRM0 expression weight, not actual muscle simulation.
 * No audio timing analysis: the already-authoritative portal speech events
 * tell us exactly when each phrase begins and ends.
 */
export type Vq05Emotion = 'joy' | 'sorrow' | 'fun'
export type Vq05ExpressionFrame = {
  emotion: Vq05Emotion | null
  weight: number
}

function normalized(s:string):string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim()
}

/** Never guess a mood from "no", a technical fact, or a person's face. */
export function explicitSpokenEmotionVQ05(phrase:string):Vq05Emotion|null {
  const spoken=normalized(String(phrase??'').slice(0,900))
  if(!spoken)return null
  if(/\b(?:lo siento mucho|siento mucho lo ocurrido|lamento (?:mucho |profundamente |lo )?|que pena|mis condolencias|siento que estes pasando|entiendo que sea dificil)\b/.test(spoken)) {
    return 'sorrow'
  }
  if(/\b(?:vaya sorpresa|que sorpresa|no me lo esperaba|que divertido|me hace gracia|que gracioso)\b/.test(spoken)) {
    return 'fun'
  }
  if(/\b(?:me alegra|felicidades|enhorabuena|lo logramos|lo conseguiste|lo lograste|que buena noticia|estoy feliz|que alegria|excelente trabajo)\b/.test(spoken) &&
    !/\b(?:no me alegra|no estoy feliz|no es una buena noticia|no es excelente)\b/.test(spoken)) {
    return 'joy'
  }
  return null
}
const clamp=(v:number,min:number,max:number)=>
  Number.isFinite(v)?Math.min(max,Math.max(min,v)):min
const WEIGHTS:Record<Vq05Emotion,number>={
  joy:.28,sorrow:.20,fun:.24,
}
const MOOD_DELAY=.12

export class SpeechExpressionVQ05 {
  private emotion:Vq05Emotion|null=null
  private active=false
  private age=0
  private strength=0

  onPhraseAudible(phrase:string):void {
    this.emotion=explicitSpokenEmotionVQ05(phrase)
    this.active=Boolean(this.emotion)
    this.age=0
    // Smoothly return toward neutral between phrases, no jump.
  }
  onSpeechEnd():void {
    this.active=false
    this.emotion=null
    this.age=0
  }
  step(dt:number,audible:boolean,blocked=false):Vq05ExpressionFrame {
    const delta=clamp(dt,0,.05)
    if(this.active && audible && !blocked)this.age+=delta
    const target=this.active && audible && !blocked &&
      this.age>=MOOD_DELAY && this.emotion
      ? WEIGHTS[this.emotion] : 0
    const rate=target>this.strength ? 5.0 : 8.0
    this.strength+=(target-this.strength)*(1-Math.exp(-delta*rate))
    if(this.strength<.0001)this.strength=0
    // Fade-out keeps the previous selected shape until neutral, unless a new
    // phrase explicitly changes it. Never blend two semantic expressions.
    return {
      emotion:this.emotion,
      weight:clamp(this.strength,0,.28),
    }
  }
}
