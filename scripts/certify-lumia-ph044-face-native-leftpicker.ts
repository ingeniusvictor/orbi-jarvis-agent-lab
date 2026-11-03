import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  resolveAvatarView,
  avatarPresenceSnapshot,
  parseLumiaAvatarAction,
  respondToLumiaAvatarAction,
  setLumiaAvatarView,
} from '../src/scene/lumia-motion-r8/avatar-presence-ph04'

const read = (path: string) =>
  readFileSync(new URL('../' + path, import.meta.url), 'utf8')

// Default is intentional and opt-in to PH-04 ASUS launcher. Explicit requested
// views must not be overwritten, including the legacy GLB rollback.
assert.equal(resolveAvatarView('', true), 'head-vrm')
assert.equal(resolveAvatarView('?foo=1', true), 'head-vrm')
assert.equal(resolveAvatarView('?lumiaAvatar=invalid', true), 'head-vrm')
assert.equal(resolveAvatarView('', false), 'legacy')
for (const view of ['head-vrm', 'bust-vrm', 'body-vrm', 'legacy']) {
  assert.equal(resolveAvatarView('?lumiaAvatar=' + view, true), view)
  assert.equal(resolveAvatarView('?lumiaAvatar=' + view, false), view)
}

// Natural Spanish commands. A named presentation is more specific than the
// word "principal" in the same turn. Multiple explicit views stay ambiguous.
const voiceCases: Array<[string, string]> = [
  ['Lumi, vuelve a la vista principal', 'head-vrm'],
  ['Lumi, cambia a la vista principal, por favor', 'head-vrm'],
  ['Lumia, cambia a la vista predeterminada', 'head-vrm'],
  ['Lumi, vuelve a la vista normal', 'head-vrm'],
  ['Lumia, necesito que cambies a la vista por defecto', 'head-vrm'],
  ['Lumi, cambia la vista principal a la vista de medio cuerpo', 'bust-vrm'],
  ['Lumi cambió la vista principal a la vista de medio cuerpo', 'bust-vrm'],
  ['Lumi, cambia a medio cuerpo', 'bust-vrm'],
  ['Lumi, ponte en cuerpo completo', 'body-vrm'],
  ['Lumi, cambia la vista principal a la vista de cuerpo completo', 'body-vrm'],
  ['Lumi, cambia a solo rostro', 'head-vrm'],
]
for (const [utterance, view] of voiceCases) {
  assert.deepEqual(parseLumiaAvatarAction(utterance), {kind: 'view', view}, utterance)
}
for (const utterance of [
  'Lumi, cambia entre medio cuerpo y cuerpo completo',
  'Lumi, cambia a medio cuerpo o a solo rostro',
  'Lumi, ¿cómo cambio la vista de Blender?',
  'Mi hijo dice que cambies a cuerpo completo',
]) {
  const parsed = parseLumiaAvatarAction(utterance)
  assert.ok(!parsed || parsed.kind !== 'view', 'No accidental switch: ' + utterance)
}

// Actual UI semantics: default face, body modes are demonstrations of Motion R8.
assert.match(respondToLumiaAvatarAction({kind: 'list-views'}), /presentación habitual es solo rostro/)
assert.match(respondToLumiaAvatarAction({kind: 'describe'}), /Mi presencia habitual es solo rostro/)
assert.match(respondToLumiaAvatarAction({kind: 'describe'}), /diecisiete animaciones Motion R8/)
setLumiaAvatarView('head-vrm')
assert.equal(avatarPresenceSnapshot().view, 'head-vrm')
assert.match(respondToLumiaAvatarAction({kind: 'view', view: 'bust-vrm'}), /medio cuerpo/)
assert.match(respondToLumiaAvatarAction({kind: 'view', view: 'head-vrm'}), /solo rostro/)

const composer = read('src/ui/LumiaComposer.tsx')
const app = read('src/App.tsx')
const dock = read('src/ui/LumiaViewDock.tsx')
const skill = read('bridge/orbia/skill-registry-skill01.mjs')
const launcher = read('INICIAR_LUMIA_ASUS_RAPIDA.cmd')
const portal = read('src/scene/LumiaPortalHead.tsx')
const css = read('src/index.css')
const picker = composer.indexOf('{avatarViewControl && <LumiaViewDock />}')
const attach = composer.indexOf("className={'lumia-composer-icon-button lumia-composer-attach'")
const textArea = composer.indexOf('className="lumia-composer-text"')
const voice = composer.indexOf("className={'lumia-composer-icon-button lumia-composer-dictate'")
assert.ok(picker > 0 && picker < attach && attach < textArea && textArea < voice,
  'Avatar view button MUST be the first action, before attachment, separated from right-side voice controls')
assert.equal(composer.split('{avatarViewControl && <LumiaViewDock />}').length, 2,
  'No duplicate avatar view picker')
assert.doesNotMatch(app, /<LumiaViewDock \/>/, 'Never add a duplicate floating view selector')
assert.match(app, /avatarViewControl=\{AVATAR_PH04_ENABLED\}/)
assert.match(launcher, /VITE_LUMIA_AVATAR_PH04=1/)
assert.match(dock, /aria-expanded=\{open\}/)
assert.match(dock, /aria-label=\{'Cambiar vista del avatar/)
assert.match(dock, /key: 'head-vrm'/)
assert.match(dock, /key: 'bust-vrm'/)
assert.match(dock, /key: 'body-vrm'/)
assert.match(css, /\.lumia-avatar-view-options[\s\S]*bottom: calc\(100% \+ 17px\)/)
assert.match(skill, /solo rostro como presentación principal/)
assert.match(portal, /const showBody = avatarView === 'bust-vrm' \|\| avatarView === 'body-vrm' \|\| showNeck/)
assert.match(portal, /body\?\.onSpokenPhrase\(data\.text\)/, 'Maintain R8 voice and semantic gestures')
assert.match(portal, /setHeadExpressions\(rig, values\)/, 'Preserve mouth and expression sync')

console.log('PH-04.4 PASS: face-first native default, explicit body showcase, safe Spanish voice intents, leftmost composer view icon, voice/VRM rollback intact')
