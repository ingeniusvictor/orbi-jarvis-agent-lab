import assert from 'node:assert/strict';
import { inferR9CueFromSpokenPhrase } from '../src/scene/lumia-motion-r9/spoken-director.js';
import { R9ExpressiveBlend } from '../src/scene/lumia-motion-r9/expressive-blend.js';
import { R9IntentController, parseR9MotionIntent } from '../src/scene/lumia-motion-r9/intent-contract.js';
import fs from 'node:fs';

let count=0;
const test=(label,fn)=>{fn();count++;console.log('PASS R9-01/02 '+label)};
const say=(text)=>inferR9CueFromSpokenPhrase(text);
const base={version:1,emotion:'focused',intensity:0.5,gesture:'explain',
  gaze:'user',posture:'attentive',duration_ms:1800};
test('explicación por frase real',()=>assert.equal(say('Primero, revisaremos el inversor.')?.gesture,'explain'));
test('explicación acentuada',()=>assert.equal(say('Te explico cómo funciona.')?.gesture,'explain'));
test('afirmación',()=>assert.equal(say('Sí, claro, es correcto.')?.gesture,'affirm'));
test('negación',()=>assert.equal(say('Eso no es correcto.')?.gesture,'deny'));
test('empatía',()=>assert.equal(say('Lamento lo ocurrido.')?.gesture,'comfort'));
test('saludo',()=>assert.equal(say('Hola, buenos días.')?.gesture,'greet'));
test('celebración',()=>assert.equal(say('¡Felicidades, lo conseguimos!')?.gesture,'celebrate'));
test('reflexión',()=>assert.equal(say('Veamos cómo se hace.')?.gesture,'think'));
test('sorpresa',()=>assert.equal(say('¡Qué sorpresa!')?.emotion,'surprised'));
test('frase neutra usa fallback R8',()=>assert.equal(say('El resultado es 45 kilovatios.'),null));
test('rechaza textos extensos y tipos inválidos',()=>{
  assert.equal(say('X'.repeat(701)),null);
  assert.equal(say({foo:1}),null);
});
test('intención generada valida el contrato estricto',()=>{
  assert.deepEqual(parseR9MotionIntent(say('Por ejemplo, el panel recibe luz.')),say('Por ejemplo, el panel recibe luz.'));
});
test('reposo no produce movimiento',()=>{
  const b=new R9ExpressiveBlend();
  const p=b.step(0.016,null);
  assert.equal(p.weight,0);
  assert.deepEqual(p.body,{});
});
test('movimiento sólo sobre huesos aprobados',()=>{
  const b=new R9ExpressiveBlend(),p=b.step(0.05,base);
  assert.ok(p.weight>0);
  assert.deepEqual(Object.keys(p.body).sort(),
    ['leftUpperArmZ','rightUpperArmZ','rightLowerArmX','leftHandX','rightHandX','chestX'].sort());
});
test('presupuesto de torso y brazos',()=>{
  const b=new R9ExpressiveBlend();
  for(let i=0;i<300;i++){
    const p=b.step(0.05,base);
    for(const [k,v] of Object.entries(p.body)){
      const max=k==='chestX'?0.012:k.includes('UpperArm')?0.055:k.includes('LowerArm')?0.04:0.03;
      assert.ok(Math.abs(v)<=max+1e-10, k+': '+v);
      assert.ok(Number.isFinite(v));
    }
    assert.ok(Math.abs(p.head.pitch)<=0.045);
    assert.ok(Math.abs(p.head.yaw)<=0.050);
    assert.ok(Math.abs(p.head.roll)<=0.025);
    assert.ok(p.expression?.weight<=0.22);
  }
});
test('interpolación ataca sin saltar al 100 %',()=>{
  const b=new R9ExpressiveBlend();
  assert.ok(b.step(0.016,base).weight<0.2);
});
test('interpolación decae al retirar orden',()=>{
  const b=new R9ExpressiveBlend();
  for(let i=0;i<40;i++)b.step(0.05,base);
  const prev=b.weight;
  b.step(0.05,null);
  assert.ok(b.weight<prev);
});
test('intensidad 0 no mueve huesos',()=>{
  const b=new R9ExpressiveBlend();
  const pose=b.step(0.05,{...base,intensity:0});
  assert.ok(Object.values(pose.body).every(v=>v===0));
});
test('emociones no inventan preset de sorpresa',()=>{
  const b=new R9ExpressiveBlend();
  const pose=b.step(0.05,say('¡Qué sorpresa!'));
  assert.ok(['fun','joy','sorrow',null].includes(pose.expression?.name??null));
});
test('todas las intenciones válidas con salida finita',()=>{
  const b=new R9ExpressiveBlend();
  for(const gesture of ['none','explain','affirm','deny','greet','comfort','celebrate','think']){
    const v=b.step(0.05,{...base,gesture});
    for(const n of Object.values(v.body))assert.ok(Number.isFinite(n));
    for(const n of Object.values(v.head))assert.ok(Number.isFinite(n));
  }
});
test('cue inicia al comienzo audible, no al generar texto',()=>{
  const c=new R9IntentController();
  assert.equal(c.queue(say('Te explico el sistema'),{sessionId:'s',turnId:'t',now:100}),true);
  assert.equal(c.snapshot({sessionId:'s',turnId:'t',now:200,audible:true}),null);
  assert.equal(c.onFirstAudio({sessionId:'s',turnId:'t',now:300}),true);
  assert.ok(c.snapshot({sessionId:'s',turnId:'t',now:400,audible:true}));
});
test('el clip manual y la demo prevalecen sobre R9',()=>{
  const c=new R9IntentController();
  c.queue(base,{sessionId:'s',turnId:'t',now:0});
  c.onFirstAudio({sessionId:'s',turnId:'t',now:1});
  assert.equal(c.snapshot({sessionId:'s',turnId:'t',now:20,audible:true,manualClip:true}),null);
  assert.equal(c.snapshot({sessionId:'s',turnId:'t',now:20,audible:true,guidedDemo:true}),null);
});
test('sin nueva frase, los gestos caducan',()=>{
  const c=new R9IntentController();
  c.queue(base,{sessionId:'s',turnId:'t',now:0});
  c.onFirstAudio({sessionId:'s',turnId:'t',now:1});
  assert.equal(c.snapshot({sessionId:'s',turnId:'t',now:1802,audible:true}),null);
});
test('R9 opt-in por URL, R8 intacto por defecto',()=>{
  const scene=fs.readFileSync(new URL('../src/scene/LumiaPortalHead.tsx',import.meta.url),'utf8');
  assert.match(scene,/get\('lumiaR9'\) === '1'/);
  assert.match(scene,/new R8BodyCompanion\(/);
  assert.match(scene,/onAudioStart\(data.turnId\)/);
  assert.match(scene,/onSpokenPhrase\(data.text, data.turnId\)/);
});
test('sin segundo LLM ni websocket de voz',()=>{
  const files=['../src/scene/lumia-motion-r9/intent-contract.js',
    '../src/scene/lumia-motion-r9/spoken-director.js',
    '../src/scene/lumia-motion-r9/expressive-blend.js'];
  for(const file of files){
    const src=fs.readFileSync(new URL(file,import.meta.url),'utf8');
    assert.doesNotMatch(src,/\bfetch\(|\bWebSocket\(|\bOllama\(/);
  }
});
console.log('R9-01/02 '+count+'/'+count+' PASS (sintético). QA visual ASUS pendiente.');
