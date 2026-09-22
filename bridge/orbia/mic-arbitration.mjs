/**
 * VG-04 Multi-Microphone Arbitration.
 *
 * A room-scale voice assistant may hear the same wake phrase from several
 * microphones. Every candidate submits a wake confidence and optional node
 * priority during a short competition window; exactly one source wins.
 *
 * No network transport is assumed here. ORBI Edge Mesh, the desktop mic and
 * future satellites can all feed the same contract.
 */

import { performance } from 'node:perf_hooks'

const finite = (value, fallback = 0) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export function weightedWakeScore(score, priority = 1) {
  return Math.max(0, finite(score)) * Math.max(0, finite(priority, 1))
}

export class MicArbitrator {
  constructor({
    windowMs = 180,
    lockMs = 4000,
    now = () => performance.now(),
  } = {}) {
    this.windowMs = Math.max(0, finite(windowMs, 180))
    this.lockMs = Math.max(100, finite(lockMs, 4000))
    this.now = now
    this.round = null
    this.owner = null
    this.lockUntil = 0
    this.sequence = 0
  }

  reserve(source, score, { priority = 1 } = {}) {
    const id = String(source || 'micro')
    const now = this.now()

    if (this.owner && now < this.lockUntil) {
      return Promise.resolve(this.owner === id)
    }

    if (!this.round) {
      const round = {
        openedAt: now,
        candidates: new Map(),
        waiters: [],
        timer: null,
      }
      round.timer = setTimeout(
        () => this.#settle(round),
        this.windowMs,
      )
      this.round = round
    }

    const round = this.round
    const value = weightedWakeScore(score, priority)
    const previous = round.candidates.get(id)
    const sequence = previous?.sequence ?? this.sequence++

    if (!previous || value > previous.value) {
      round.candidates.set(id, {
        source: id,
        score: Math.max(0, finite(score)),
        priority: Math.max(0, finite(priority, 1)),
        value,
        sequence,
      })
    }

    return new Promise((resolve) => {
      round.waiters.push({ source: id, resolve })
    })
  }

  #settle(round) {
    if (this.round !== round) return

    const candidates = [...round.candidates.values()]
    let winner = null

    for (const candidate of candidates) {
      if (
        !winner ||
        candidate.value > winner.value ||
        (
          candidate.value === winner.value &&
          candidate.sequence < winner.sequence
        )
      ) {
        winner = candidate
      }
    }

    if (winner) {
      this.owner = winner.source
      this.lockUntil = this.now() + this.lockMs
    } else {
      this.owner = null
      this.lockUntil = 0
    }

    this.round = null
    for (const waiter of round.waiters) {
      waiter.resolve(Boolean(winner && waiter.source === winner.source))
    }
  }

  release(source = null) {
    if (source == null || String(source) === this.owner) {
      this.owner = null
      this.lockUntil = 0
      return true
    }
    return false
  }

  reset() {
    const round = this.round
    this.round = null
    this.owner = null
    this.lockUntil = 0
    if (round?.timer) clearTimeout(round.timer)
    for (const waiter of round?.waiters ?? []) waiter.resolve(false)
  }

  status() {
    const now = this.now()
    return Object.freeze({
      owner: now < this.lockUntil ? this.owner : null,
      locked: Boolean(this.owner && now < this.lockUntil),
      lockRemainingMs:
        this.owner && now < this.lockUntil
          ? Math.max(0, this.lockUntil - now)
          : 0,
      competing: Boolean(this.round),
      candidates: this.round?.candidates.size ?? 0,
      windowMs: this.windowMs,
      lockMs: this.lockMs,
    })
  }
}
