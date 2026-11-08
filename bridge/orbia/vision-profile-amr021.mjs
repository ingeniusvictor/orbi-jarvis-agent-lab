/**
 * AMR-02.1 — bounded Ollama vision context for the ASUS 4 GiB GPU.
 *
 * qwen3.5:4b-fast is an owner-created 2048-token model profile, already
 * verified at 100% GPU for text. The older visual caller forced 4096 tokens,
 * negating that profile and potentially reloading to CPU/shared memory.
 *
 * Do NOT change other models, image bytes, caching, STT/TTS or model selection.
 * The 2048-token setting does not guarantee any image will fit: vision needs
 * extra projector and image-token memory, so surface the error transparently.
 */
export function visualOptionsForModel(model) {
  const name = String(model ?? '').trim().toLowerCase()
  return {
    temperature: 0,
    num_ctx: name === 'qwen3.5:4b-fast' ? 2048 : 4096,
    num_predict: 256,
  }
}

/** No image payload or private prompt content is emitted in diagnosis. */
export function visualFailureCategory(error) {
  const message = String(error?.message ?? error ?? '').toLowerCase()
  if (/not support.*(image|vision)|image.*not supported|does not support images|vision.*not supported/.test(message)) return 'unsupported'
  if (/context.*(exceed|long|length|short|window)|prompt.*(too long|tokens|length)|token.*(limit|context)/.test(message)) return 'context'
  if (/out of memory|not enough memory|insufficient memory|failed to allocate|cuda|vram|oom|allocation failed/.test(message)) return 'memory'
  if (/ollama visual http 50\d|runner.*(crash|error)|model runner|llama server/.test(message)) return 'runner'
  return 'unknown'
}
