import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import process from 'node:process'

const file = 'ollama/Modelfile.lumia-es'
const model = process.env.ORBIA_LUMIA_MODEL ?? 'orbia-lumia:4b'

if (!existsSync(file)) {
  console.error(`[orbia] missing ${file}`)
  process.exit(1)
}

console.log(`[orbia] creating local model ${model} from ${file}`)
const result = spawnSync('ollama', ['create', model, '-f', file], {
  stdio: 'inherit',
  shell: false,
})

if (result.error) {
  console.error('[orbia] could not launch Ollama:', result.error.message)
  process.exit(1)
}

process.exit(result.status ?? 1)
