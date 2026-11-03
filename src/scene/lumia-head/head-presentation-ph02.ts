/**
 * PH-02 optical calibration. The original face VRM remains immutable.
 * "baseline" restores the PH-01 framing / head movement and light preset.
 */
export function usePh02Presentation(search = '') {
  return new URLSearchParams(search).get('lumiaHeadQA') !== 'baseline'
}

export function useNeckPreview(search = '') {
  return usePh02Presentation(search) &&
    new URLSearchParams(search).get('lumiaNeck') === '1'
}

const clamp = (v, low, high) => Math.min(high, Math.max(low, v))

export function calculateHeadMotion({ x = 0, y = 0, phase = 'dormant', seconds = 0 } = {}) {
  const px = clamp(Number(x) || 0,-1,1)
  const py = clamp(Number(y) || 0,-1,1)
  const attention =
    phase === 'listening' ? 1
      : phase === 'speaking' ? 0.92
        : phase === 'thinking' || phase === 'tooling' ? 0.78 : 0.62

  // PH-01 used local negative yaw on VRM0 eyes. But the portal already rotates
  // the VRM 180 degrees, causing the eyes to follow the opposite horizontal
  // direction. Only invert X; keep the tested vertical axis unchanged.
  const eyeYaw = px * 0.135
  const eyePitch = py * 0.13

  // Rotate a presentation pivot at FACE CENTRE; unlike the unreliable
  // humanoid-bone-only path, this visibly moves face and hair together.
  // ~9 degrees yaw and ~6 degrees pitch at full attention.
  const headYaw = px * 0.165 * attention + Math.sin(seconds * 0.23) * 0.018
  const headPitch = py * 0.105 * attention + (phase === 'thinking' ? -0.024 : 0)
  const roll = Math.sin(seconds * 0.19) * 0.012

  return Object.freeze({ eyeYaw, eyePitch, headYaw, headPitch, roll })
}
