/**
 * PH-03 Body Companion — local adapter around the original R8 motion sources.
 *
 * Single Three/R3F scene, no second TTS, WebGL renderer or conversational LLM.
 * The procedural R8 pose is available without FBX; 17 approved local clips are
 * requested lazily only when the owner enables the Body VRM view.
 *
 * Important: this portal still uses a raw VRM0 GLTF humanoid, not the separate
 * Motion Lab three-vrm normalized rig. The raw-bone FBX bridge is experimental:
 * failed/missing clips must fall back to the verified procedural motion, not a
 * rigid T-pose or an uncaught renderer error. Physical ASUS QA remains required.
 */
import * as THREE from 'three'
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js'
import type { HeadRig } from '../lumia-head/vrm0-head'
import { BodyMotionCore } from './body-motion-core.js'
import { BodyPresenceCore } from './body-presence.js'
import { MotionIntelligence } from './motion-intelligence.js'
import { SemanticMotionCore } from './semantic-motion.js'
import { PoseTransition } from './pose-transition.js'
import { retargetMixamoUpperBody } from './mixamo-retarget.js'
import { animationLibrary } from './motion-library-catalog.js'
import { boundR8BodyPose } from './pose-guard-ph042'
import { guidedDemoSnapshot, reportGuidedDemoClip } from './avatar-demo-ph045'

type MotionState = 'idle' | 'listening' | 'thinking' | 'speaking'
const LOWER_BODY_BONES = [
  'leftUpperLeg','rightUpperLeg','leftLowerLeg','rightLowerLeg',
  'leftFoot','rightFoot','leftToes','rightToes',
] as const
type ClipInfo = { clip: THREE.AnimationClip; id: string; loop: boolean; repetitions: number }
type BodyPose = Record<string, number>
type SemanticPose = { head: {pitch:number;yaw:number;roll:number}; body:BodyPose; kind:string|null }
const PROCEDURAL_BONES = [
  'leftShoulder','rightShoulder','leftUpperArm','rightUpperArm',
  'leftLowerArm','rightLowerArm','leftHand','rightHand','chest','spine','hips',
] as const

export function portalMotionState(phase:string, audible:boolean):MotionState {
  if (audible) return 'speaking'
  if (phase === 'listening' || phase === 'waking') return 'listening'
  if (phase === 'thinking' || phase === 'tooling') return 'thinking'
  return 'idle'
}

export function isR8BodyMode(search:string):boolean {
  const params=new URLSearchParams(search)
  return ['body-vrm','bust-vrm'].includes(params.get('lumiaAvatar') ?? '') ||
    params.get('lumiaBody') === '1' || params.get('lumiaNeck') === '1'
}

export function isR8ClipEnabled(search:string):boolean {
  return isR8BodyMode(search) &&
    new URLSearchParams(search).get('lumiaR8') !== 'procedural'
}

export class R8BodyCompanion {
  private readonly core = new BodyMotionCore()
  private readonly presence = new BodyPresenceCore()
  private readonly director = new MotionIntelligence({
    enabled:true,variety:38,allowCircle:false,allowTalkInterruptions:false,
    autoIdleEnabled:true,
  })
  private readonly semantic = new SemanticMotionCore({enabled:true,intensity:48})
  private readonly blend = new PoseTransition(.44)
  private readonly rest = new Map<string,THREE.Quaternion>()
  private readonly proceduralBase = new Map<string,THREE.Quaternion>()
  private readonly euler = new THREE.Euler(0,0,0,'XYZ')
  private readonly q = new THREE.Quaternion()
  private readonly qSample = new THREE.Quaternion()
  private readonly activeMixer:THREE.AnimationMixer
  private readonly cache = new Map<string,ClipInfo>()
  private readonly failed = new Set<string>()
  private pending:string|null = null
  private activeId:string|null = null
  private action:THREE.AnimationAction|null = null
  private activeLoop=false
  private gestureToken:{id:string;reason:string;revision:number}|null = null
  private semanticGestureUsed:string|null = null
  private lastState:MotionState='idle'
  private elapsed=0
  private manualUntil=0
  private demoClipId:string|null=null
  private demoLoopCount=0
  private demoLoopTarget=0
  private readonly allowClips:boolean
  private readonly safePose:boolean
  private readonly fullBodySafe:boolean
  private readonly rig:HeadRig

  constructor(rig:HeadRig,{allowClips=false,safePose=true,fullBodySafe=false}:{allowClips?:boolean;safePose?:boolean;fullBodySafe?:boolean}={}) {
    this.rig=rig
    this.allowClips=allowClips
    this.safePose=safePose
    this.fullBodySafe=fullBodySafe
    this.activeMixer=new THREE.AnimationMixer(rig.scene)
    for(const [name,bone] of rig.bodyBones) this.rest.set(name,bone.quaternion.clone())
    // The full R8 viewer also performs a short warm-up BEFORE the first frame
    // to eliminate a T-pose flash. Preserve that behavior in Portal Body.
    for(let k=0;k<55;k++){
      this.core.step(.05,this.config('idle'))
      this.presence.step(.05,this.presenceConfig('idle'))
    }
    this.applyProcedural(this.core.step(.001,this.config('idle')),
      this.presence.step(.001,this.presenceConfig('idle')))
    this.activeMixer.addEventListener('finished',()=>{
      if(this.demoClipId && this.demoClipId===this.activeId) {
        reportGuidedDemoClip(this.demoClipId,'finished')
        this.demoClipId=null
        this.manualUntil=0
      }
      if(!this.activeLoop) this.stopClip()
    })
    this.activeMixer.addEventListener('loop',()=>{
      if(!this.demoClipId || !this.activeLoop ||
          this.demoClipId!==this.activeId) return
      this.demoLoopCount++
      if(this.demoLoopCount>=this.demoLoopTarget){
        reportGuidedDemoClip(this.demoClipId,'finished')
        this.demoClipId=null
        this.manualUntil=0
        this.stopClip()
      }
    })
  }

  get boneCount() {return this.rest.size}
  get clipStatus() {return {active:this.activeId,pending:this.pending,failed:[...this.failed]}}
  get clipCount() {return Object.keys(animationLibrary).length}

  private config(behavior:MotionState) {
    return {
      behavior,live:true,bodyMotion:true,bodyPose:'natural',bodyIntensity:.60,
      bodySpeed:5,bodyDepth:.75,bodyWrist:.75,bodyDepthSign:1,
    }
  }
  private presenceConfig(behavior:MotionState) {
    return {...this.config(behavior),enabled:true,idleLevel:65,listeningLevel:80}
  }

  private applyProcedural(base:BodyPose,presence:{offsets:BodyPose}):void {
    // In full-body mode the procedural driver does not animate legs. Reset
    // them to the original VRM0 bind pose every frame, so a previous FBX clip
    // cannot leave an ankle or knee permanently twisted when it finishes.
    if (this.fullBodySafe && this.safePose) {
      for (const name of LOWER_BODY_BONES) {
        const node=this.rig.bodyBones.get(name)
        const rest=this.rest.get(name)
        if (node && rest) node.quaternion.copy(rest)
      }
    }
    const extra=presence.offsets ?? {}
    for(const name of PROCEDURAL_BONES) {
      const bone=this.rig.bodyBones.get(name)
      const rest=this.rest.get(name)
      if(!bone || !rest)continue
      this.euler.set(
        (base[name+'X']??0)+(extra[name+'X']??0),
        (base[name+'Y']??0)+(extra[name+'Y']??0),
        (base[name+'Z']??0)+(extra[name+'Z']??0),
        'XYZ')
      this.q.setFromEuler(this.euler)
      bone.quaternion.copy(rest).multiply(this.q)
    }
  }

  private stopClip():void {
    if (this.demoClipId) {
      reportGuidedDemoClip(this.demoClipId,'cancelled')
      this.demoClipId=null
      this.manualUntil=0
    }
    if(!this.action)return
    this.blend.capture([...this.rig.bodyBones.values()],.44)
    this.action.stop()
    this.activeMixer.stopAllAction()
    this.action=null
    this.activeId=null
    this.activeLoop=false
  }

  private retargetRawPose(clip:THREE.AnimationClip):THREE.AnimationClip {
    // R8 creates animation quaternions for three-vrm NORMALIZED bones whose
    // bind rotations are identity. This GLTFLoader-only portal animates original
    // VRM0 RAW bones: compose each track with its raw rest rotation.
    const byName=new Map([...this.rig.bodyBones.values()].map(b=>[b.name,b]))
    const tracks=clip.tracks.map(track=>{
      if(!track.name.endsWith('.quaternion'))return track.clone()
      const node=byName.get(track.name.slice(0,-'.quaternion'.length))
      if(!node)return track.clone()
      const original=this.rest.get([...this.rig.bodyBones].find(([,b])=>b===node)?.[0]??'')
        ?? node.quaternion.clone()
      const values=new Float32Array(track.values.length)
      for(let k=0;k<values.length;k+=4){
        this.qSample.fromArray(track.values,k)
        this.qSample.premultiply(original).normalize()
        this.qSample.toArray(values,k)
      }
      return new THREE.QuaternionKeyframeTrack(track.name,track.times,values)
    })
    return new THREE.AnimationClip(clip.name,clip.duration,tracks)
  }

  private async loadClip(id:string):Promise<ClipInfo> {
    const cached=this.cache.get(id)
    if(cached)return cached
    const config=animationLibrary[id]
    if(!config)throw Error('R8 clip desconocido: '+id)
    // Only local owner-supplied clips; nothing from GitHub, Mixamo, CDN or APIs.
    const asset=await new FBXLoader().loadAsync(config.path)
    const shim={
      meta:{metaVersion:'0'},
      humanoid:{getNormalizedBoneNode:(name:string)=>this.rig.bodyBones.get(name)??null},
    }
    const result=retargetMixamoUpperBody(asset,shim,THREE,{
      fullBody:Boolean(config.fullBody),
      includeHips:Boolean(config.includeHips),
      includeHead:false, // preserve tested PH-02 eye/head tracking
    })
    const entry={
      id,clip:this.retargetRawPose(result.clip),
      loop:Boolean(config.loop),repetitions:config.repetitions||1,
    }
    this.cache.set(id,entry)
    return entry
  }

  private playReady(clip:ClipInfo):void {
    const guided = this.demoClipId===clip.id
    if (guided) this.demoClipId=null
    this.stopClip()
    if (guided) this.demoClipId=clip.id
    this.blend.capture([...this.rig.bodyBones.values()],.44)
    const action=this.activeMixer.clipAction(clip.clip)
    // Waving repeats twice and Clapping three times in the original R8
    // catalog. THREE.LoopOnce ignores repetition counts: choose LoopRepeat
    // for those finite author-approved repeats, and wait for 'finished'.
    const repeat = clip.loop || clip.repetitions > 1
    action.reset().setLoop(
      repeat ? THREE.LoopRepeat : THREE.LoopOnce,
      clip.loop ? Infinity : clip.repetitions,
    )
    action.clampWhenFinished=!clip.loop
    action.enabled=true
    action.setEffectiveWeight(1)
    action.play()
    this.action=action
    this.activeId=clip.id
    this.activeLoop=clip.loop
  }

  requestClip(id:string,manual=false):void {
    if(!this.allowClips||!animationLibrary[id]||this.failed.has(id)||
       this.pending||this.activeId===id)return
    this.pending=id
    const stateAtRequest=this.lastState
    void this.loadClip(id).then(clip=>{
      if(this.pending!==id || (!manual && this.lastState!==stateAtRequest) ||
         (manual && this.elapsed>=this.manualUntil))return
      this.playReady(clip)
      if (manual && this.demoClipId===id) {
        this.demoLoopCount=0
        this.demoLoopTarget=clip.loop
          ? (clip.clip.duration < 3 ? 2 : 1) : 0
        reportGuidedDemoClip(id,'started',clip.clip.duration,
          clip.loop?this.demoLoopTarget:clip.repetitions)
        console.info('[lumia:ph046] R8 clip started, actual seconds:',
          id,clip.clip.duration,'cycles:',
          clip.loop?this.demoLoopTarget:clip.repetitions)
      }
      this.director.commit(this.gestureToken,this.elapsed)
      console.info('[lumia:ph03] R8 animation:',id)
    }).catch((err:unknown)=>{
      if(manual && this.demoClipId===id){
        reportGuidedDemoClip(id,'failed')
        this.demoClipId=null
        this.manualUntil=0
      }
      this.failed.add(id)
      console.warn('[lumia:ph03] FBX no disponible/compatible. Continúa pose corporal natural:',id,err)
    }).finally(()=>{
      if(this.pending===id)this.pending=null
      this.gestureToken=null
    })
  }

  /** Owner-authorized one-shot request; temporary priority over automatic R8. */
  requestManualClip(id:string, guided=false):boolean {
    if (!this.allowClips || !animationLibrary[id] || this.failed.has(id)) {
      if (guided) reportGuidedDemoClip(id,'failed')
      return false
    }
    this.pending=null // invalidate older asynchronous auto/gesture loading
    this.stopClip()
    // PH-04.6: a real demo must NOT kill a clip after 7.5 seconds. Stop only
    // when the actual FBX animation mixer reports finishing, or the owner
    // cancels. Infinite-loop clips complete after 1 or 2 *real* cycles.
    this.manualUntil=guided?Number.POSITIVE_INFINITY:this.elapsed+7.5
    this.demoClipId=guided?id:null
    this.demoLoopCount=0
    this.demoLoopTarget=0
    this.requestClip(id,true)
    return true
  }

  resumeAutomatic():void {
    this.pending=null
    this.stopClip()
    this.manualUntil=0
    this.director.postpone(this.elapsed,.2)
  }

  onSpokenPhrase(text:string):void {
    this.semantic.begin(text)
    this.semanticGestureUsed=null
  }
  onSpeechEnd():void {
    this.semantic.end()
    // During the owner-guided tour, "Talking.fbx" must complete its actual
    // authored cycle even after the short narration has finished.
    if(this.activeId==='talking' && !this.demoClipId)this.stopClip()
  }

  step(dt:number,phase:string,speechAudible:boolean):SemanticPose {
    dt=Math.min(.05,Math.max(0,dt))
    this.elapsed+=dt
    const state=portalMotionState(phase,speechAudible)
    if(state!==this.lastState){
      this.lastState=state
      this.semanticGestureUsed=null
      if (this.elapsed>=this.manualUntil) this.stopClip()
      this.director.observe(state,this.elapsed)
    }
    const pose=this.core.step(dt,this.config(state))
    const presence=this.presence.step(dt,this.presenceConfig(state))
    this.applyProcedural(pose,presence)
    if (this.safePose && this.action) {
      for (const [name, node] of this.rig.bodyBones) {
        const current = this.proceduralBase.get(name)
        if (current) current.copy(node.quaternion)
        else this.proceduralBase.set(name, node.quaternion.clone())
      }
    }

    if (this.manualUntil>0 && this.elapsed>=this.manualUntil) {
      this.manualUntil=0
      this.stopClip()
      this.director.postpone(this.elapsed,.3)
    }
    if(this.action)this.activeMixer.update(dt)
    this.blend.step(dt)

    const semantic=this.semantic.step(dt,{speaking:speechAudible}) as SemanticPose
    for(const [name,value] of Object.entries(semantic.body)){
      const axis=name.at(-1)?.toUpperCase()
      const boneName=name.slice(0,-1)
      const bone=this.rig.bodyBones.get(boneName)
      if(!bone || !axis || !Number.isFinite(value) || Math.abs(value)<1e-7)continue
      this.euler.set(axis==='X'?value:0,axis==='Y'?value:0,axis==='Z'?value:0)
      this.q.setFromEuler(this.euler)
      bone.quaternion.multiply(this.q)
    }
    // R8 semantic gestures only when the actual TTS text is audibly playing.
    if(semantic.kind && semantic.kind!==this.semanticGestureUsed && speechAudible &&
       this.elapsed>=this.manualUntil && !guidedDemoSnapshot().active){
      this.semanticGestureUsed=semantic.kind
      const mapping:Record<string,string>={
        greet:'waving',affirm:'happy',deny:'no',explain:'pointinggesture',
        surprise:'surprised',celebrate:'excited',think:'thinking',
      }
      const clip=mapping[semantic.kind]
      if(clip && (this.activeId==='talking'||!this.activeId))this.requestClip(clip)
    }
    // Cap retargeted upper-body extremes. PH-03 still plays genuine R8 clips;
    // this affects only the visible result and never changes the private FBX.
    if (this.safePose && this.action) {
      boundR8BodyPose(this.rig.bodyBones, this.proceduralBase,
        this.manualUntil > this.elapsed, this.fullBodySafe)
    }
    if(this.allowClips && !this.pending && this.elapsed>=this.manualUntil &&
       !guidedDemoSnapshot().active){
      const intent=this.director.decide({
        now:this.elapsed,state,activeId:this.activeId,
        active:Boolean(this.activeId),pending:Boolean(this.pending),
        transitioning:this.blend.active,
      })
      if(intent?.id && !this.failed.has(intent.id)){
        this.gestureToken=intent
        this.requestClip(intent.id)
      }
    }
    return semantic
  }

  dispose():void {
    this.stopClip()
    this.pending=null
    this.activeMixer.stopAllAction()
    this.cache.clear()
  }
}
