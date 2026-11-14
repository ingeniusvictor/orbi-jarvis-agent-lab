import assert from 'node:assert/strict';
import { parseR9MotionIntent, R9IntentController, R9_MOTION_JSON_SCHEMA } from '../src/scene/lumia-motion-r9/intent-contract.js';
const valid = {
  version: 1, emotion: 'focused', intensity: 0.45,
  gesture: 'explain', gaze: 'user', posture: 'attentive', duration_ms: 2400,
};
let tests = 0;
function check(label, callback) { callback(); tests++; console.log('PASS R9-00 ' + label); }
check('schema con valores restringidos y sin ángulos', () => {
  assert.equal(R9_MOTION_JSON_SCHEMA.additionalProperties, false);
  assert.equal('bones' in R9_MOTION_JSON_SCHEMA.properties, false);
});
check('intención válida, congelada', () => {
  let out = parseR9MotionIntent(JSON.stringify(valid));
  assert.deepEqual(out, valid);
  assert.ok(Object.isFrozen(out));
});
check('rechaza JSON inválido', () => assert.equal(parseR9MotionIntent('{'), null));
check('rechaza arrays y null', () => {
  assert.equal(parseR9MotionIntent([]), null);
  assert.equal(parseR9MotionIntent(null), null);
});
check('rechaza huesos y órdenes extra', () => assert.equal(parseR9MotionIntent({...valid, rightUpperArmZ: 3}), null));
check('rechaza enums inventados', () => assert.equal(parseR9MotionIntent({...valid, gesture: 'runShell'}), null));
check('rechaza intensidad fuera de rango', () => assert.equal(parseR9MotionIntent({...valid, intensity: 3}), null));
check('rechaza duración excesiva', () => assert.equal(parseR9MotionIntent({...valid, duration_ms: 999999}), null));
check('rechaza NaN y Infinity', () => assert.equal(parseR9MotionIntent({...valid, intensity: Infinity}), null));
check('rechaza duration fraccional', () => assert.equal(parseR9MotionIntent({...valid, duration_ms: 350.5}), null));
check('no gesticula antes de iniciar audio', () => {
  const c = new R9IntentController();
  assert.equal(c.queue(valid, {sessionId: 's1', turnId: 1, now: 100}), true);
  assert.equal(c.snapshot({sessionId: 's1', turnId: 1, now: 250, audible:true}), null);
});
check('no acepta audio de otro turno o sesión', () => {
  const c = new R9IntentController();
  c.queue(valid, {sessionId: 's1', turnId: 1, now: 100});
  assert.equal(c.onFirstAudio({sessionId: 's1', turnId: 2, now: 300}), false);
  assert.equal(c.onFirstAudio({sessionId: 's2', turnId: 1, now: 300}), false);
});
check('sincroniza con audio audible y caduca', () => {
  const c = new R9IntentController();
  c.queue(valid, {sessionId: 's1', turnId: 't1', now: 100});
  assert.equal(c.onFirstAudio({sessionId: 's1', turnId: 't1', now: 500}), true);
  assert.equal(c.snapshot({sessionId: 's1', turnId: 't1', now: 600, audible:true})?.gesture, 'explain');
  assert.equal(c.snapshot({sessionId: 's1', turnId: 't1', now: 600, audible:false}), null);
  assert.equal(c.snapshot({sessionId: 's1', turnId: 't1', now: 2900, audible:true}), null);
});
check('prioridad a gesto manual, demo o baile', () => {
  const c = new R9IntentController();
  c.queue(valid, {sessionId:'s',turnId:'t',now:0});
  c.onFirstAudio({sessionId:'s',turnId:'t',now:1});
  for (const override of ['manualClip','guidedDemo','dancing']) {
    assert.equal(c.snapshot({sessionId:'s',turnId:'t',now:2,audible:true,[override]:true}), null);
  }
});
check('la interrupción borra la intención', () => {
  const c = new R9IntentController();
  c.queue(valid, {sessionId:'s',turnId:'t',now:0});
  c.onFirstAudio({sessionId:'s',turnId:'t',now:1});
  assert.equal(c.snapshot({sessionId:'s',turnId:'t',now:2,interrupted:true,audible:true}),null);
  assert.ok(c.idle);
});
check('no reproduce una intención tardía', () => {
  const c = new R9IntentController();
  c.queue(valid, {sessionId:'s',turnId:'t',now:0});
  assert.equal(c.onFirstAudio({sessionId:'s',turnId:'t',now:16000}),false);
});
check('fail closed ante IDs ausentes', () => {
  const c=new R9IntentController();
  assert.equal(c.queue(valid, {sessionId:'',turnId:'t',now:1}),false);
  assert.equal(c.onFirstAudio({sessionId:'s',turnId:'t',now:3}),false);
});
console.log('LUMIA Motion R9-00: ' + tests + '/' + tests + ' PASS — sin conexión a VRM/voz/Ollama');
