/**
 * NF-01 — conservative opt-in microphone focus for the ASUS pilot.
 *
 * Energy and mic gain cannot prove who is speaking or distance. This gentle,
 * reversible filter reduces far-field pickup, especially during WAKE,
 * without locking out a second legitimate speaker or touching Voice Gate.
 */
export type FocusMode = 'wake' | 'command' | 'guard' | 'deaf'
export const FOCUS_WAKE_MULTIPLIER = 1.25
export const FOCUS_COMMAND_MULTIPLIER = 1.08
export const FOCUS_WAKE_MIN_RMS = 0.009
export const FOCUS_COMMAND_MIN_RMS = 0.006
export const FOCUS_WAKE_START_MS = 170

/** Never weaken the existing GUARD echo threshold. */
export function focusedVadThreshold(
  existing: number, mode: FocusMode, enabled: boolean, guarded: boolean,
): number {
  if (!enabled || guarded || !Number.isFinite(existing) || existing < 0) return existing
  if (mode === 'wake') return Math.max(existing * FOCUS_WAKE_MULTIPLIER, FOCUS_WAKE_MIN_RMS)
  if (mode === 'command') return Math.max(existing * FOCUS_COMMAND_MULTIPLIER, FOCUS_COMMAND_MIN_RMS)
  return existing
}

/** Short wake-name bursts must be sustained; normal command onset unchanged. */
export function focusedVadOnsetMs(
  current: number, mode: FocusMode, enabled: boolean, guarded: boolean,
): number {
  return enabled && !guarded && mode === 'wake'
    ? Math.max(current, FOCUS_WAKE_START_MS)
    : current
}
