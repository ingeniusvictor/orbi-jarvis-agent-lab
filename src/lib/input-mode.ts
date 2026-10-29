/** UX-01: one brain, three explicit input policies. */
export type LumiaInputMode = 'text' | 'push' | 'continuous'
export function initialLumiaInputMode(optIn: boolean): LumiaInputMode {
  return optIn ? 'text' : 'continuous'
}
export function shouldRunAlwaysOnVoice(mode: LumiaInputMode): boolean {
  return mode === 'continuous'
}
export function canCapturePushVoice(mode: LumiaInputMode): boolean {
  return mode === 'push'
}
