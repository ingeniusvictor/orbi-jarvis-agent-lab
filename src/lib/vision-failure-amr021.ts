/**
 * AMR-02.1 — honest spoken failure recovery for a visual request.
 *
 * Do not claim a model lacks vision when Ollama may have run out of GPU
 * memory or received an overlong image prompt. Technical details stay in
 * local console; no image content is ever added to conversation history.
 */
export type LumiaVisualFailureKind = 'unsupported'|'context'|'memory'|'runner'|'unknown'
export function classifyLumiaVisualFailure(error:unknown):LumiaVisualFailureKind {
  const value=String(error instanceof Error?error.message:error??'').toLowerCase()
  if(/not support.*(image|vision)|image.*not supported|does not support images|vision.*not supported/.test(value))return 'unsupported'
  if(/context.*(exceed|long|length|short|window)|prompt.*(too long|tokens|length)|token.*(limit|context)/.test(value))return 'context'
  if(/out of memory|not enough memory|insufficient memory|failed to allocate|cuda|vram|oom|allocation failed/.test(value))return 'memory'
  if(/ollama visual http 50\d|runner.*(crash|error)|model runner|llama server/.test(value))return 'runner'
  return 'unknown'
}
export function lumiaVisualFailureReply(error:unknown,followup:boolean):string {
  const category=classifyLumiaVisualFailure(error)
  const subject=followup?'volver a analizar esa fotografía':'analizar la fotografía'
  if(category==='unsupported')return `No pude ${subject}. El modelo activo informa que no admite imágenes. Selecciona uno con visión en Ollama.`
  if(category==='memory')return `No pude ${subject}. Ollama informó un problema de memoria o GPU. Prueba con Qwen 2B y revisa la consola local.`
  if(category==='context')return `No pude ${subject}. La solicitud visual excedió el contexto admitido. Prueba el cerebro 2B y revisa el diagnóstico de Ollama.`
  return `No pude ${subject} con el modelo local seleccionado. Revisa el diagnóstico de Ollama; no significa necesariamente que carezca de visión.`
}
