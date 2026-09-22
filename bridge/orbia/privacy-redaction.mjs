/**
 * L9 Privacy Redaction.
 *
 * Last-resort masking for logs, delegated summaries and other surfaces that do
 * not need exact secrets. This is intentionally NOT applied to ordinary user
 * answers because the user may explicitly ask L.U.M.I.A. to read an address,
 * phone number or identifier.
 */

const RULES = Object.freeze([
  [/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/gi, '[email]'],
  [/\b(?:sk|pk|ghp|gho|ghs|xox[baprs]|AKIA|AIza)[-_A-Za-z0-9]{10,}\b/g, '[secret]'],
  [/\b(?:\+?\d[ .-]?){9,}\d\b/g, '[number]'],
  [/\b[A-Za-z0-9_-]{36,}\b/g, '[token]'],
])

export function redactSensitiveText(value) {
  let text = String(value ?? '')
  for (const [pattern, replacement] of RULES) {
    text = text.replace(pattern, replacement)
  }
  return text
}

export function redactForLog(value, maxChars = 500) {
  const limit = Math.max(40, Math.min(5000, Number(maxChars) || 500))
  const text = redactSensitiveText(value)
    .replace(/\s+/g, ' ')
    .trim()

  if (text.length <= limit) return text
  return text.slice(0, limit).replace(/\s+\S*$/, '').trim() + '…'
}
