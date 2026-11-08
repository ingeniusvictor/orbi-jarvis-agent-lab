/**
 * Ollama /api/chat includes prompt_eval_cached_count only in supported builds.
 * Absence is UNKNOWN, not zero and never proof a photo was cached.
 * No prompt, JPEG, file name, image digest or user content is logged.
 */
export function formatVisionCacheMetrics(packet){
  const total=Number(packet?.prompt_eval_count)
  const raw=packet?.prompt_eval_cached_count
  if(raw===undefined || raw===null)return 'cachedTokens=unavailable'
  const cached=Number(raw)
  if(!Number.isSafeInteger(cached)||cached<0||!Number.isSafeInteger(total)||total<0||cached>total)
    return 'cachedTokens=unavailable'
  const share=total>0?(100*cached/total):0
  return \`cachedTokens=\${cached} cachedShare=\${share.toFixed(1)}%\`
}
