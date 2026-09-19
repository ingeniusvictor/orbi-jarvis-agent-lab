import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import {
  BRAIN_SETTINGS_PATH,
  readBrainSettings,
  writeBrainSettings,
} from '../bridge/providers/brain-settings.mjs'
import { openAIConfigured } from '../bridge/providers/openai.mjs'

const rl = createInterface({ input, output })

console.log('')
console.log('L.U.M.I.A. · Configuración del cerebro')
console.log('--------------------------------------')
console.log('')
console.log('1) LOCAL  · Ollama/Qwen · offline · sin API')
console.log('2) HYBRID · local por defecto + OpenAI cuando conviene')
console.log('3) CLOUD  · OpenAI como cerebro principal')
console.log('')

const current = readBrainSettings()
console.log(
  `Configuración actual: ${current.provider ?? 'predeterminada (LOCAL en L.U.M.I.A.)'}`,
)
console.log('')

try {
  const answer = (await rl.question('Selecciona 1, 2 o 3: ')).trim()

  const provider =
    answer === '1'
      ? 'ollama'
      : answer === '2'
        ? 'hybrid'
        : answer === '3'
          ? 'openai'
          : null

  if (!provider) {
    console.error('Selección inválida. No se realizaron cambios.')
    process.exitCode = 1
  } else {
    let cloudHistory = current.cloudHistory

    if (provider === 'hybrid' || provider === 'openai') {
      const history = (
        await rl.question(
          '¿Permitir contexto reciente de conversación al cloud? [S/n]: ',
        )
      )
        .trim()
        .toLowerCase()

      cloudHistory = history !== 'n' && history !== 'no'
    }

    const saved = writeBrainSettings({
      provider,
      cloudHistory,
    })

    console.log('')
    console.log(`Modo guardado: ${saved.provider.toUpperCase()}`)
    console.log(
      `Contexto cloud: ${saved.cloudHistory ? 'permitido' : 'solo pregunta actual'}`,
    )
    console.log(`Archivo local: ${BRAIN_SETTINGS_PATH}`)
    console.log('')
    console.log('Cierra y vuelve a abrir L.U.M.I.A. para aplicar el cambio.')

    if (
      (provider === 'hybrid' || provider === 'openai') &&
      !openAIConfigured()
    ) {
      console.log(
        'Si todavía no configuraste OpenAI, ejecuta CONFIGURAR_API_OPENAI_LUMIA.cmd.',
      )
    }
  }
} finally {
  rl.close()
}
