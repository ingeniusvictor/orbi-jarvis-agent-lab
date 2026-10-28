/**
 * Local timing diagnosis only. These are browser-observed event timestamps,
 * never acoustic microphone measurements, so do not label them "silence in
 * the room". The decomposition shows what delayed the NEXT phrase after the
 * previous sentence had already finished playing.
 */
export type PhraseGapTiming = {
  gapMs: number | null
  waitingTextMs: number | null
  waitingAudioMs: number | null
  waitingPlaybackMs: number | null
}

export function attributePhraseGap(
  previousEndAt: number,
  queuedAt: number,
  synthesisReadyAt: number | undefined,
  playedAt: number,
): PhraseGapTiming {
  if (!Number.isFinite(previousEndAt) || previousEndAt <= 0 ||
      !Number.isFinite(playedAt) || playedAt < previousEndAt) {
    return {
      gapMs: null,
      waitingTextMs: null,
      waitingAudioMs: null,
      waitingPlaybackMs: null,
    }
  }

  const gapMs = playedAt - previousEndAt
  const waitingTextMs = Math.min(
    gapMs, Math.max(0, queuedAt - previousEndAt),
  )

  if (synthesisReadyAt == null || !Number.isFinite(synthesisReadyAt)) {
    return {
      gapMs, waitingTextMs, waitingAudioMs: null, waitingPlaybackMs: null,
    }
  }

  const waitingAudioMs = Math.min(
    gapMs - waitingTextMs,
    Math.max(0, synthesisReadyAt - Math.max(previousEndAt, queuedAt)),
  )
  const waitingPlaybackMs = Math.max(
    0, gapMs - waitingTextMs - waitingAudioMs,
  )
  return { gapMs, waitingTextMs, waitingAudioMs, waitingPlaybackMs }
}
