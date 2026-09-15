import process from 'node:process'

const url = (process.env.JARVIS_OLLAMA_URL ?? 'http://127.0.0.1:11434').replace(/\/+$/, '')
const model = process.env.ORBIA_LUMIA_MODEL ?? 'orbia-lumia:4b'

const prompts = [
  'Hola, preséntate en una sola frase.',
  '¿Cómo te llamas y cuál es tu relación con O.R.B.I.A.?',
  'Explícame qué hace un inversor fotovoltaico en dos frases.',
  'What is your name? Responde en español.',
  'Responde en una frase: ¿qué puedes hacer en esta fase sin herramientas?',
]

const suspicious = [
  '<think>',
  '</think>',
  'the user',
  'we need to',
  'i need to',
  'okay,',
  'answer in spanish',
  'respond in spanish',
]

async function chat(prompt) {
  const res = await fetch(`${url}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      think: false,
      messages: [{ role: 'user', content: prompt }],
      options: { temperature: 0.2 },
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`)
  }

  const data = await res.json()
  return String(data?.message?.content ?? '').trim()
}

console.log(`\nL.U.M.I.A. Spanish certification · model: ${model}\n`)

let failures = 0

for (let i = 0; i < prompts.length; i += 1) {
  const prompt = prompts[i]
  try {
    const answer = await chat(prompt)
    const lower = answer.toLowerCase()
    const leaked = suspicious.filter((term) => lower.includes(term))
    const ok = Boolean(answer) && leaked.length === 0

    console.log(`[${ok ? 'PASS' : 'WARN'}] Turno ${i + 1}`)
    console.log(`USER: ${prompt}`)
    console.log(`LUMI: ${answer || '(respuesta vacía)'}`)
    if (leaked.length) console.log(`Detectado: ${leaked.join(', ')}`)
    console.log('')

    if (!ok) failures += 1
  } catch (err) {
    failures += 1
    console.log(`[FAIL] Turno ${i + 1}`)
    console.log(`USER: ${prompt}`)
    console.log(`ERROR: ${String(err?.message ?? err)}\n`)
  }
}

if (failures === 0) {
  console.log('RESULTADO: PASS básico. Revise también que las cinco respuestas suenen naturales en español.\n')
  process.exit(0)
}

console.log(`RESULTADO: ${failures} turno(s) requieren revisión.\n`)
process.exit(1)
