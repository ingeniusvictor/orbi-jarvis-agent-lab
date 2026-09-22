/**
 * VG-03A Adaptive Acoustic Front-End.
 *
 * Pure signal-state model used by the browser VAD. It deliberately does not
 * decide identity or liveness; it produces truthful acoustic evidence that
 * later Voice Gate phases can fuse with speaker verification and anti-replay.
 *
 * The current VAD ratios are preserved so introducing this module does not
 * change the certified trigger behaviour. The new capability is echo-baseline
 * observation while Speaker Shield suppresses STT recording.
 */

export type AcousticSnapshot = {
  energy: number
  floor: number
  threshold: number
  release: number
  echoBaseline: number
  floorRatio: number
  echoRatio: number
  calibrated: boolean
  suppressed: boolean
  guard: boolean
}

export type AcousticObservation = {
  guard?: boolean
  speaking?: boolean
  armed?: boolean
  suppressed?: boolean
}

export const ACOUSTIC_DEFAULTS = Object.freeze({
  triggerOverFloor: 2.6,
  guardBoost: 2.4,
  releaseRatio: 0.6,
  floorUp: 0.0008,
  floorDown: 0.02,
  minFloor: 0.0015,
  smoothing: 0.5,
  echoUp: 0.08,
  echoDown: 0.025,
  calibrationFrames: 45,
})

const sane = (value: number, fallback = 0) =>
  Number.isFinite(value) && value >= 0 ? value : fallback

export class AdaptiveAcousticFrontEnd {
  private floor = 0.01
  private smoothEnergy = 0
  private echoBaseline = 0
  private idleFrames = 0

  observe(
    rawEnergy: number,
    observation: AcousticObservation = {},
  ): AcousticSnapshot {
    const energy = sane(rawEnergy)
    const {
      guard = false,
      speaking = false,
      armed = false,
      suppressed = false,
    } = observation

    this.smoothEnergy +=
      (energy - this.smoothEnergy) * ACOUSTIC_DEFAULTS.smoothing

    // During Speaker Shield we still observe the microphone but never treat
    // the measured energy as ambient-room floor. It is predominantly our own
    // loudspeaker return and therefore belongs in a separate baseline.
    if (suppressed) {
      const rate =
        this.smoothEnergy > this.echoBaseline
          ? ACOUSTIC_DEFAULTS.echoUp
          : ACOUSTIC_DEFAULTS.echoDown
      this.echoBaseline +=
        (this.smoothEnergy - this.echoBaseline) * rate
      this.echoBaseline = Math.max(0, this.echoBaseline)
    } else if (!speaking && !armed) {
      const rate =
        this.smoothEnergy > this.floor
          ? ACOUSTIC_DEFAULTS.floorUp
          : ACOUSTIC_DEFAULTS.floorDown
      this.floor += (this.smoothEnergy - this.floor) * rate
      this.floor = Math.max(this.floor, ACOUSTIC_DEFAULTS.minFloor)
      this.idleFrames++
    }

    const threshold =
      this.floor *
      ACOUSTIC_DEFAULTS.triggerOverFloor *
      (guard ? ACOUSTIC_DEFAULTS.guardBoost : 1)

    const floorRatio =
      this.floor > 0 ? this.smoothEnergy / this.floor : 0
    const echoRatio =
      this.echoBaseline > ACOUSTIC_DEFAULTS.minFloor
        ? this.smoothEnergy / this.echoBaseline
        : 0

    return {
      energy: this.smoothEnergy,
      floor: this.floor,
      threshold,
      release: threshold * ACOUSTIC_DEFAULTS.releaseRatio,
      echoBaseline: this.echoBaseline,
      floorRatio,
      echoRatio,
      calibrated:
        this.idleFrames >= ACOUSTIC_DEFAULTS.calibrationFrames,
      suppressed,
      guard,
    }
  }

  snapshot(guard = false): AcousticSnapshot {
    const threshold =
      this.floor *
      ACOUSTIC_DEFAULTS.triggerOverFloor *
      (guard ? ACOUSTIC_DEFAULTS.guardBoost : 1)
    return {
      energy: this.smoothEnergy,
      floor: this.floor,
      threshold,
      release: threshold * ACOUSTIC_DEFAULTS.releaseRatio,
      echoBaseline: this.echoBaseline,
      floorRatio:
        this.floor > 0 ? this.smoothEnergy / this.floor : 0,
      echoRatio:
        this.echoBaseline > ACOUSTIC_DEFAULTS.minFloor
          ? this.smoothEnergy / this.echoBaseline
          : 0,
      calibrated:
        this.idleFrames >= ACOUSTIC_DEFAULTS.calibrationFrames,
      suppressed: false,
      guard,
    }
  }
}
