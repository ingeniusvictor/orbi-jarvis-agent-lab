/** Deterministic accuracy metrics. No data retention or model access. */
export function stt02Words(value) {
  return String(value ?? '').toLocaleLowerCase('es').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean)
}
export function wordErrorRate(reference, hypothesis) {
  const a = stt02Words(reference), b = stt02Words(hypothesis)
  if (!a.length) throw new Error('Se requiere transcripción de referencia.')
  if (a.length > 5000 || b.length > 5000) throw new Error('La comparación excede el límite.')
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const row = Array(b.length + 1).fill(0)
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j-1] + 1,
        prev[j-1] + (a[i-1] === b[j-1] ? 0 : 1))
    }
    prev = row
  }
  return Object.freeze({ referenceWords: a.length, recognizedWords: b.length,
    errors: prev[b.length], wer: prev[b.length] / a.length })
}
