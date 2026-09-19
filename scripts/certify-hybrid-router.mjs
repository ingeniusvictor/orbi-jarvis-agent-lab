import assert from 'node:assert/strict'
import {
  chooseHybridRoute,
  parseHybridRouteOverride,
} from '../bridge/providers/hybrid.mjs'

let route = chooseHybridRoute('Hola, ¿cómo estás?', {
  cloudConfigured: true,
})
assert.equal(route.provider, 'ollama')

route = chooseHybridRoute(
  'Analiza esta arquitectura y compara varias alternativas. Quiero una explicación detallada paso a paso.',
  { cloudConfigured: true },
)
assert.equal(route.provider, 'openai')

route = chooseHybridRoute(
  'Analiza esta arquitectura y compara varias alternativas. Quiero una explicación detallada paso a paso.',
  { cloudConfigured: false },
)
assert.equal(route.provider, 'ollama')
assert.equal(route.reason, 'cloud-unconfigured')

const explicitCloud = parseHybridRouteOverride(
  'Lumi, usa OpenAI para analizar este problema',
)
assert.equal(explicitCloud.provider, 'openai')
assert.equal(explicitCloud.prompt, 'analizar este problema')

const explicitLocal = parseHybridRouteOverride(
  'Lumi, usa local para responder esto',
)
assert.equal(explicitLocal.provider, 'ollama')
assert.equal(explicitLocal.prompt, 'responder esto')

console.log('HBR-01 hybrid brain router: PASS')
console.log('Simple -> local · complex -> cloud · no key -> local fallback')
