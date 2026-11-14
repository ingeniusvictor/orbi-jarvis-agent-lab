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
  weights: Record<Vq05Emotion,number>
  dominant: Vq05Emotion | null
}

function normalized(s:string):string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim()
}

/** Never guess a mood from "no", a technical fact, or a person's face. */
export function explicitSpokenEmotionVQ05(phrase:string):Vq05Emotion|null {
  const spoken=normalized(String(phrase??'').slice(0,900))
  if(!spoken)return null
  // A vocabulary explanation containing an emotion word is not itself
  // an emotional utterance (e.g. "¿qué significa felicidades?").
  if(/\b(?:significado|significa|definicion|la palabra|la frase|traduce|explica que es)\b/.test(spoken)){
    return null
  }
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
// VQ-05.1: the original 0.20–0.28 weights were too subtle on Vita.
// Conversational reactions stay below the 0.80 explicit preview and
// never become full-strength theatrical expressions.
const WEIGHTS:Record<Vq05Emotion,number>={
  joy:.48,sorrow:.48,fun:.50,
}
const MOOD_DELAY=.12

export class SpeechExpressionVQ05 {
  private emotion:Vq05Emotion|null=null
  private active=false
  private age=0
  private readonly levels:Record<Vq05Emotion,number>={
    joy:0,sorrow:0,fun:0,
  }

  onPhraseAudible(phrase:string):void {
    this.emotion=explicitSpokenEmotionVQ05(phrase)
    this.active=Boolean(this.emotion)
    this.age=0
    // Do not reset the previous shape abruptly when a new phrase starts.
  }
  onSpeechEnd():void {
    this.active=false
    this.emotion=null
    this.age=0
  }
  step(dt:number,audible:boolean,blocked=false):Vq05ExpressionFrame {
    const delta=clamp(dt,0,.05)
    if(this.active && audible && !blocked)this.age+=delta
    const chosen=this.active && audible && !blocked &&
      this.age>=MOOD_DELAY ? this.emotion : null
    for(const name of ['joy','sorrow','fun'] as const){
      const target=chosen===name?WEIGHTS[name]:0
      const rate=target>this.levels[name]?5.0:8.0
      this.levels[name]+=(target-this.levels[name])*(1-Math.exp(-delta*rate))
      if(this.levels[name]<.0001)this.levels[name]=0
    }
    const dominant=(['joy','sorrow','fun'] as const).reduce<Vq05Emotion|null>(
      (best,name)=>this.levels[name]>(best?this.levels[best]:.025)?name:best,null,
    )
    return {weights:{...this.levels},dominant}
  }
}
