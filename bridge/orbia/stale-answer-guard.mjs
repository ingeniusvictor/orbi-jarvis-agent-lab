/**
 * LUMIA CG-01 — Guard against local-model conversational perseveration.
 *
 * A new Ollama request can generate substantially the same long answer to a
 * different question. This is NOT a cached HTTP response and is distinct from
 * an audio or STT failure. Only compare within the SAME canonical conversation.
 *
 * No telemetry, network, writing permissions or storage; fully deterministic.
 */
const fold = (value) => String(value ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('es')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim().replace(/\s+/g, ' ')

const isRepeatRequest = (prompt) =>
  /\b(?:repit|repite|repetir|dilo otra vez|dime otra vez|vuelve a decir|lo mismo|otra vez)\b/i.test(fold(prompt))

function similarity(a, b) {
  if (a === b) return 1
  const x = a.split(' ')
  const y = b.split(' ')
  if (x.length < 14 || y.length < 14) return 0
  const counts = new Map()
  for (let i = 0; i < x.length - 1; i++) {
    const bigram = x[i] + ' ' + x[i + 1]
    counts.set(bigram, (counts.get(bigram) ?? 0) + 1)
  }
  let common = 0
  for (let i = 0; i < y.length - 1; i++) {
    const bigram = y[i] + ' ' + y[i + 1]
    const left = counts.get(bigram) ?? 0
    if (left > 0) {
      counts.set(bigram, left - 1)
      common++
    }
  }
  return 2 * common / (x.length + y.length - 2)
}

export function isStaleModelReply({ answer, prompt, history = [] } = {}) {
  const latest = fold(answer)
  const question = fold(prompt)
  if (latest.length < 95 || !question || !Array.isArray(history) || isRepeatRequest(prompt)) return false

  const previousQuestions = history.filter((entry) => entry?.role === 'user')
  if (previousQuestions.length && fold(previousQuestions[previousQuestions.length - 1].content) === question) {
    return false // The owner intentionally asked the same question again.
  }

  const previousAnswers = history.filter((entry) => entry?.role === 'assistant').slice(-3)
  return previousAnswers.some((entry) => {
    const prior = fold(entry.content)
    return prior.length >= 95 && similarity(latest, prior) >= 0.90
  })
}
